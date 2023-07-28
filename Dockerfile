FROM --platform=linux/amd64 node:18
RUN ["apt-get","update"]
RUN ["apt-get","install","-y","vim"]
WORKDIR /usr/src/runner
COPY ./ .
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
