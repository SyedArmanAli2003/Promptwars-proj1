# Use the official lightweight Nginx image
FROM nginx:alpine

# Copy all files from the current directory to the Nginx HTML root
COPY . /usr/share/nginx/html

# Cloud Run expects the container to listen on $PORT (default 8080)
# We update the default Nginx configuration to listen on port 8080 instead of 80
RUN sed -i 's/listen  \[::\]:80;/listen \[::\]:8080;/g' /etc/nginx/conf.d/default.conf && \
    sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf

# Expose port 8080
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
