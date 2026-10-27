FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN python3 -m venv /venv && /venv/bin/pip install --no-cache-dir -r requirements.txt
COPY server.py import_video.py ./
ENV PATH="/venv/bin:${PATH}" MEDIA_ROOT=/data MEDIA_HOST=127.0.0.1 MEDIA_PORT=8792
USER node
CMD ["python", "server.py"]
