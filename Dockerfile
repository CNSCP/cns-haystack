FROM node:18

# Install the Dapr Binary into the container
WORKDIR /tmp
RUN curl -Lo install-dapr-cli.sh https://raw.githubusercontent.com/dapr/cli/master/install/install.sh \
  && bash install-dapr-cli.sh \
  && dapr --version

# Install the appliation
WORKDIR /app
COPY package.json package-lock.json /app/

RUN npm install

COPY . /app/

# Start in production mode
CMD ["npm", "run", "production"]
