'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompilePackages {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:package:compileEvents': () => BbPromise.bind(this)
        .then(this.setup)
        .then(this.mergeActionPackages),
      'package:compileEvents': this.compilePackages.bind(this),
    };
  }

  setup() {
    // This object will be used to store the Packages resource, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.packages = {};
  }

  mergeActionPackages() {
    const packages = this.getActionPackages();
    if (!packages.length) return;

    if (!this.serverless.service.resources) {
      this.serverless.service.resources = {};
    }

    if (!this.serverless.service.resources.packages) {
      this.serverless.service.resources.packages = {};
    }

    const manifestPackages = this.serverless.service.resources.packages || {};

    packages.forEach(pkge => {
      manifestPackages[pkge] = manifestPackages[pkge] || {}
    })
  }

  getActionPackages() {
    const actionPackages = new Set();

    this.serverless.service.getAllFunctions()
      .map(name => this.serverless.service.getFunction(name))
      .filter(func => func.name)
      .forEach(func => {
        const id = func.name.match(/^(.+)\/.+$/)
        if (id) actionPackages.add(id[1])
      });

    return [...actionPackages];
  }

  compilePackage(name, params) {
    const pkge = { name, overwrite: true };

    pkge.namespace = params.namespace
      || this.serverless.service.provider.namespace;

    if (params.hasOwnProperty('overwrite')) {
      pkge.overwrite = params.overwrite;
    } else if (this.serverless.service.provider.hasOwnProperty('overwrite')) {
      pkge.overwrite = params.overwrite;
    }

    if (params.parameters) {
      pkge.package = {}
      pkge.package.parameters = Object.keys(params.parameters).map(
        key => ({ key, value: params.parameters[key] })
      );
    }

    if (this.options.verbose) {
      this.serverless.cli.log(`Compiled Package (${name}): ${JSON.stringify(pkge)}`);
    }

    return pkge;
  }

  compilePackages() {
    this.serverless.cli.log('Compiling Packages...');

    const manifestResources = this.serverless.service.resources;
    const owPackages = this.serverless.service.packages;

    if (!owPackages) {
      throw new this.serverless.classes.Error(
        'Missing Packages section from OpenWhisk Resource Manager template');
    }

    if (manifestResources && manifestResources.packages) {
      Object.keys(manifestResources.packages).forEach(pkge => {
        owPackages[pkge] = this.compilePackage(pkge, manifestResources.packages[pkge]);
      });
    }

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskCompilePackages;