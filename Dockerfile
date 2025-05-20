FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Install dev dependencies (needed for nodemon)
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
