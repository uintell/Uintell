FROM node:22-alpine

WORKDIR /workspace
COPY . /workspace
RUN npm install

WORKDIR /workspace/apps/web
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
