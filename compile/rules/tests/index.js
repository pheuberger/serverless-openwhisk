'use strict';

const BbPromise = require('bluebird');
const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileRules = require('../index');
const Serverless = require('serverless');

describe('OpenWhiskCompileRules', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileRules;

  beforeEach(() => {
    serverless = new Serverless();
    sandbox = sinon.sandbox.create();
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileRules = new OpenWhiskCompileRules(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.defaults = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { log: () => {} };
    openwhiskCompileRules.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#compileRules()', () => {
    it('should throw an error if the resource section is not available', () => {
      openwhiskCompileRules.serverless.service.rules = null;
      expect(() => openwhiskCompileRules.compileRules())
        .to.throw(Error, /Missing Rules section/);
    });

    it('should return empty rules if functions has no triggers', () =>
      expect(openwhiskCompileRules.compileRules().then(() => {
        expect(openwhiskCompileRules.serverless.service.rules).to.deep.equal({});
      })).to.eventually.be.fulfilled
    );

    it('should call compileFunctionRule and update rules for each function with events', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileFunctionRules').returns([{ruleName: 'ruleName'}]);
      openwhiskCompileRules.serverless.service.rules = {};

      sandbox.stub(openwhiskCompileRules.serverless.service, 'getAllFunctions', () => ["first", "second", "third"]);

      const handler = name => ({events: {}})
      sandbox.stub(
        openwhiskCompileRules.serverless.service, 'getFunction', name => handler(name)
      );

      return expect(openwhiskCompileRules.compileRules().then(() => {
        expect(openwhiskCompileRules.serverless.service.rules).to.deep.equal({
          'ruleName': {ruleName: 'ruleName'}
        });
        expect(stub.calledThrice).to.be.equal(true);
      })).to.eventually.be.fulfilled;
    });
  });

  describe('#compileFunctionRules()', () => {
    it('should not call compileRule when events parameter is missing', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule')
      const rules = openwhiskCompileRules.compileFunctionRules('name', {})
      expect(rules).to.deep.equal([]);
      expect(stub.called).to.be.equal(false);
    })
    
    it('should not call compileRule when events list contains no triggers', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule')
      const rules = openwhiskCompileRules.compileFunctionRules('name', { events: [{"api": {}}] })
      expect(rules).to.deep.equal([]);
      expect(stub.called).to.be.equal(false);
    })

    it('should call compileRule when events list contains triggers', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule').returns({})
      const rules = openwhiskCompileRules.compileFunctionRules('name', { events: [
        {"trigger": {}},
        {"trigger": {}},
        {"trigger": {}},
      ] })
      expect(rules).to.deep.equal([{}, {}, {}]);
      expect(stub.calledThrice).to.be.equal(true);
    })
  });

  describe('#compileRule()', () => {
    it('should define rules from trigger string', () => {
      openwhiskCompileRules.serverless.service.service = 'my-service' 
      openwhiskCompileRules.serverless.service.provider.namespace = "sample_ns"
      const funcObj = {}
      const trigger = "some-trigger"
      const testing = {
        ruleName: 'my-service_some-trigger_to_action-name', 
        action: 'my-service_action-name',
        trigger: 'some-trigger',
        namespace: 'sample_ns', 
        overwrite: true
      };
      const result = openwhiskCompileRules.compileRule('action-name', {}, trigger);
      return expect(result).to.deep.equal(testing);
    });

    it('should define rules from trigger object', () => {
      openwhiskCompileRules.serverless.service.service = 'my-service' 
      openwhiskCompileRules.serverless.service.provider.namespace = "sample_ns"
      const funcObj = { namespace: 'custom_ns' }
      const trigger = {name: "custom_trigger_name", rule: "custom_rule_name", overwrite: false}
      const testing = {
        ruleName: 'custom_rule_name', 
        action: 'my-service_action-name',
        trigger: 'custom_trigger_name',
        namespace: 'custom_ns',
        overwrite: false 
      };
      const result = openwhiskCompileRules.compileRule('action-name', funcObj, trigger);
      return expect(result).to.deep.equal(testing);
    });

    it('should throw if trigger missing rule', () => {
      expect(() => openwhiskCompileRules.compileRule('', {}, {name: ''}))
        .to.throw(Error, /Missing mandatory rule property from Event Trigger/);
    });

    it('should throw if trigger missing name', () => {
      expect(() => openwhiskCompileRules.compileRule('', {}, {rule: ''}))
        .to.throw(Error, /Missing mandatory name property from Event Trigger/);
    });


    /*
    it('should define rules with manifest params', () => {
      const params = { overwrite: true, namespace: 'another_ns', parameters: { hello: 'world' } };
      const expected = {
        ruleName: 'testing',
        overwrite: true,
        namespace: 'another_ns',
        parameters: [{ key: 'hello', value: 'world' }],
      };
      const result = openwhiskCompileRules.compileRule('testing', params);
      return expect(result).to.deep.equal(expected);
    });

    it('should define rules with feed manifest params', () => {
      const feedName = '/ns/package/feed';
      const params = { feed: feedName, feed_parameters: { hello: 'world' } };
      const expected = {
        ruleName: 'myRule',
        overwrite: true,
        namespace: 'testing',
        feed: {
          feedName: 'package/feed',
          namespace: 'ns',
          rule: '/testing/myRule',
          params: params.feed_parameters,
        },
      };
      const result = openwhiskCompileRules.compileRule('myRule', params);
      return expect(result).to.deep.equal(expected);
    });
    */
  });
});
