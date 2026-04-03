FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY well-known/ /etc/nginx/well-known-root/.well-known/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]