# axhub 배포용 — Next.js (next.config.ts 의 output:"standalone") 를 빌드해 node 로 서빙.
# standalone 은 자체 server.js + 최소 node_modules 를 .next/standalone 에 담아요.
# (public/ 은 이 템플릿에 없어 생략 — 추가하면 `COPY --from=build /app/public ./public` 줄을 더하세요.)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build              # output:"standalone" → .next/standalone

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
