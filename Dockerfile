#NodeJs
FROM node:erbium-buster

#WORKDIR
WORKDIR /usr/src/app

#COPY FILES
COPY package*.json ./

#INSTALL
RUN npm install

#COPY OTHERS
COPY . .

#PORT SELECT
ENV HTTP_PORT=3010
ENV P2P_PORT=6010

#PORT EXPOSE
EXPOSE 3010
EXPOSE 6010

#HELLO
CMD ["npm", "run", "start"]
