# Imagen minima para el backend de la boda.
# El contexto de build es la RAIZ del repo (para poder servir tambien el sitio
# estatico), por eso se construye asi desde la raiz:
#
#     docker build -f server/Dockerfile -t boda-backend .
#
# o simplemente con docker compose (ver server/docker-compose.yml).
FROM node:20-alpine

WORKDIR /app

# Copiamos todo el repo: el backend sirve index.html + assets ademas de la API.
COPY . .

# Datos persistentes
ENV DATA_DIR=/data
VOLUME ["/data"]

ENV PORT=3000
EXPOSE 3000

# Usuario no root
RUN addgroup -S boda && adduser -S boda -G boda \
    && mkdir -p /data && chown -R boda:boda /data
USER boda

CMD ["node", "server/server.js"]
