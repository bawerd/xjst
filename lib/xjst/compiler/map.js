var assert = require('assert');
var util = require('util');

var GenericBody = require('./body').GenericBody;

function Map(compiler, pairs) {
  GenericBody.call(this, compiler);
  assert(pairs.length > 0);

  this.shareable = false;
  this.pairs = {};
  this.predicate = pairs ? pairs[0].predicate.expr : null;

  if (pairs) {
    pairs.forEach(function(pair) {
      pair.bodies.forEach(function(body) {
        this.add(pair.predicate.expr, pair.predicate.value, body);
      }, this);
    }, this);
  }

  this.compiler.registerMap(this);
};
util.inherits(Map, GenericBody);
exports.Map = Map;

Map.prototype.selfSize = function selfSize() {
  return 0;
};

Map.prototype.getSize = function getSize() {
  return 0;
};

Map.prototype.getChildren = function getChildren() {
  return Object.keys(this.pairs).map(function(key) {
    var pair = this.pairs[key];
    return pair.bodies;
  }, this).reduce(function(left, right) {
    return left.concat(right);
  }, []);
};

Map.prototype.add = function add(predicate, value, body) {
  assert(value.type === 'Literal' && typeof value.value === 'string');
  if (this.predicate === null) this.predicate = predicate;

  var valueId = this.compiler.getId(value);
  if (!this.pairs[valueId]) {
    this.pairs[valueId] = {
      value: value,
      bodies: [body]
    };
  } else {
    this.pairs[valueId].bodies.push(body);
  }
};

Map.prototype.getMap = function getMap() {
  return {
    type: 'VariableDeclaration',
    kind: 'var',
    declarations: [{
      type: 'VariableDeclarator',
      id: this.compiler.getMapName(this),
      init: {
        type: 'ObjectExpression',
        properties: Object.keys(this.pairs).map(function(id) {
          var pair = this.pairs[id];
          var out = [];
          if (pair.bodies.length === 1) {
            out = out.concat(pair.bodies[0].render(true).apply);
          } else {
            pair.bodies.forEach(function(body) {
              out = out.concat(body.render().apply);
            });
          }
          out = out.concat({
            type: 'ReturnStatement',
            argument: this.compiler.ref
          });
          return {
            type: 'Property',
            key: pair.value,
            value: {
              type: 'FunctionExpression',
              id: null,
              params: [ this.compiler.ctx ],
              defaults: [],
              rest: null,
              generator: false,
              expression: false,
              body: {
                type: 'BlockStatement',
                body: out
              }
            },
            kind: 'init'
          }
        }, this)
      }
    }]
  };
};

Map.prototype.render = function render() {
  assert(this.predicate !== null);
  var res = { type: 'Identifier', name: '__$mr' },
      check = this.compiler.checkRef(res);

  return {
    apply: [{
      type: 'VariableDeclaration',
      kind: 'var',
      declarations: [{
        type: 'VariableDeclarator',
        id: res,
        init: {
          type: 'MemberExpression',
          computed: true,
          object: this.compiler.getMapName(this),
          property: this.predicate
        }
      }]
    }, {
      type: 'IfStatement',
      test: res,
      consequent: {
        type: 'BlockStatement',
        body: [{
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            operator: '=',
            left: res,
            right: {
              type: 'CallExpression',
              callee: res,
              arguments: [this.compiler.ctx]
            }
          }
        }].concat(check.apply)
      },
      alternate: null
    }]
  };
};
