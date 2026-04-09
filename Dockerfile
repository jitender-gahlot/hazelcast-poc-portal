# ── Production Dockerfile for POC Portal ────────────────────────────────────
# Static single-page app served by Nginx on port 8080 as a non-root user.
# ────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Apply latest security patches on the base image
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Create a non-root user/group for nginx
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

# Remove default nginx config and default content
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy application
COPY poc-portal.html /usr/share/nginx/html/index.html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Set ownership of static content and writable nginx directories
RUN chown -R appuser:appgroup \
        /usr/share/nginx/html \
        /var/log/nginx \
        /var/cache/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expose unprivileged port (no NET_BIND_SERVICE capability needed)
EXPOSE 8080

# Drop to non-root user
USER appuser

# Container health check — uses the /health endpoint defined in nginx.conf
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
