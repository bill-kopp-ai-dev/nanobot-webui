# Stage 1: Build React frontend
FROM oven/bun:1-alpine AS frontend-builder
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app

# Use Alibaba apt mirror for faster downloads in China
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true

# System dependencies:
#   git       - for pip VCS installs and nanobot workspace ops
#   curl      - needed by Node binary download
#   nodejs    - from npmmirror.com CN mirror, avoids deb.nodesource.com
#   uv        - installed via pip + aliyun PyPI mirror, avoids astral.sh
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        xz-utils \
    && ARCH=$(dpkg --print-architecture) \
    && NODE_VERSION=22.14.0 \
    && case "$ARCH" in \
         amd64) NODE_ARCH=x64 ;; \
         arm64) NODE_ARCH=arm64 ;; \
         *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
       esac \
    && curl -fsSL "https://npmmirror.com/mirrors/node/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
       | tar -xJ -C /usr/local --strip-components=1 \
    && pip install -i https://mirrors.aliyun.com/pypi/simple/ uv \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md setup.py ./
COPY webui/ ./webui/
# Place built frontend where server.py and package-data expect it
COPY --from=frontend-builder /app/dist ./webui/web/dist/

ENV UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
RUN uv pip install --system --no-cache .

EXPOSE 8080
CMD ["python", "-m", "webui", "--port", "8080"]
