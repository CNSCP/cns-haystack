# CNS-Haystack

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [License](#license)
- [Copyright Notice](#copyright-notice)

## About

This repository contains the CNS Haystack application that talks to the CNS Dapr Sidecar, written in [Node.js](https://nodejs.org/en/about) and using the [Dapr SDK](https://docs.dapr.io/developing-applications/sdks/js/). The application is used in conjunction with CNS Dapr and it is assumed this is already installed and running (See the [CNS Dapr](https://github.com/CNSCP/cns-dapr) repository for details).

The application ......

## Installing

To **install** or **update** the application, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/cnscp/cns-haystack.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-haystack` project directory. Go to the project directory and install Node.js dependancies with:

```sh
npm install
```

Your application should now be ready to rock.

## Usage

Once installed, run the application with:

```sh
npm run start
```

To shut down the application, hit `ctrl-c`.

### Environment Variables

The app uses the following environment variables to configure itself:

| Name             | Description                 | Default                     |
|------------------|-----------------------------|-----------------------------|
| CNS_CONTEXT      | CNS Broker context          | Must be set                 |
| CNS_DAPR         | CNS Dapr application        | 'cns-dapr'                  |
| CNS_DAPR_HOST    | CNS Dapr host               | 'localhost'                 |
| CNS_DAPR_PORT    | CNS Dapr port               | '3500'                      |
| CNS_PUBSUB       | CNS Dapr PUBSUB component   | 'cns-pubsub'                |
| CNS_SERVER_HOST  | CNS Client server host      | 'localhost'                 |
| CNS_SERVER_PORT  | CNS Client server port      | '3100'                      |
| HAYSTACK_URI     | Haystack server URI         | 'http://localhost:8080/api' |
| HAYSTACK_USER    | Haystack auth username      | ''                          |
| HAYSTACK_PASS    | Haystack auth password      | ''                          |
| HAYSTACK_VERSION | Haystack protocol version   | '3.0'                       |
| HAYSTACK_FORMAT  | Haystack protocol format    | 'text/zinc'                 |

Alternatively, variables can be stored in a `.env` file in the project directory.

### Command line tool

```sh
npm install -g .
```

## Haxall

### Installing

Point your browser to https://github.com/haxall/haxall/releases and download the latest zip file from Assets. Choose a directory to keep Haxall in and unzip the release file there.

### Initializing

Go to the Haxall directory and type:

```sh
bin/hx init cns
```

Follow the prompts to create the `cns` database.

Set CNS Haystack environment variables:

```sh
export HAYSTACK_URI=http://localhost:[PORT]/api
export HAYSTACK_USER=[USERNMAE]
export HAYSTACK_PASS=[PASSWORD]
```

Replacing `[PORT]`, `[USERNAME]` and `[PASSWORD]` with the appropriate values.

### Running

Run the Haxall server with:

```sh
bin/hx run cns
```

Or run without authentication:

```sh
bin/hx run cns -noAuth
```

### Importing data

With Haxall running, point your browser to 'http://localhost:8080' and login to the Haxall shell. At the shell prompt type:

```
ioReadZinc(`https://project-haystack.org/example/download/alpha.zinc`).map(r=>diff(null, r, {add}).commit)
```

This will import the example Alpha site. Other example sites here 'https://project-haystack.org/example'.

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
