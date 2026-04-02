FROM minio/mc:latest AS mc-source

FROM alpine:3.19

# Copy MinIO client from official image (ensures correct architecture)
COPY --from=mc-source /usr/bin/mc /usr/local/bin/mc

RUN apk add --no-cache \
    postgresql15-client \
    sqlite \
    bash \
    tzdata

COPY entrypoint.sh /entrypoint.sh
COPY backup.sh /backup.sh
RUN chmod +x /entrypoint.sh /backup.sh

ENTRYPOINT ["/entrypoint.sh"]
