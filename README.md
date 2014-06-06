Miner
=====

Miner for some data on web.

How to run easily(node.js is required):
Execute following commands under this folder
```sh
npm install
./jobs.openshift/cron/hourly/search-on-web.js
```

Deploy command:
```sh
rm -rf dest/* && rm -rf dest/.openshift
cp -rf * dest/ && mv dest/jobs.openshift dest/.openshift
```
then commit.

Note:
* part of dependencies in package.json is for tasks in .openshift

