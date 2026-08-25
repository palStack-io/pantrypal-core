FROM alpine:3.19

RUN apk add --no-cache \
    postgresql15-client \
    bash \
    tzdata

COPY entrypoint.sh /entrypoint.sh
COPY backup.sh /backup.sh
RUN chmod +x /entrypoint.sh /backup.sh

ENTRYPOINT ["/entrypoint.sh"]
