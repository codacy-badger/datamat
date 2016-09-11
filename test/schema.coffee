{should, expect}  = require 'chai'
{Schema}  = require( '../src/schemaroller' ).SchemaRoller
should()
describe 'Schema Class Test Suite', ->
  it 'should only allow elements for a schema object', =>
    expect(-> new Schema value:'test').to.throw "value for schema element 'value' has invalid type '<Test>'" #"type '<Test>' for schema element 'value.type' was invalid"
    expect(-> new Schema value:'String').to.not.throw "schema element was malformed"
    expect(-> new Schema value:foo:'test').to.throw "value for schema element 'value' was malformed. Property 'type' was missing"
    expect(-> new Schema value:type:'String').to.not.throw "value for schema element 'value' was malformed. Property 'type' was missing"
    o = value: {type:'String', foo: 'test'}
    expect(-> new Schema o).to.throw "schema element 'value.foo' is not allowed"
    expect(=> new Schema o, extensible:true).to.throw "type '<test>' for schema element \'value.foo\' was invalid"
    o.value.foo = 'String'
    expect(-> new Schema o, extensible:true).to.not.throw "schema element 'value.foo' is not allowed"

  it 'should validate data set to it', ->
    _S = new Schema elements: value:'String'
    (_S.set(value:1) instanceof Schema).should.be.false
    (_S.set(value:"1") instanceof Schema).should.be.true
    _S = new Schema elements: value:'Number'
    (_S.set(value:1) instanceof Schema).should.be.true
    (_S.set(value:"A String") instanceof Schema).should.be.false
    
  it 'should only allow valid types', =>
    expect(-> new Schema value:type:'Nada').to.throw "value for schema element 'value' has invalid type '<Nada>'"
    
  it 'should init with valid schema', =>
    expect(-> new Schema value:type:'String').to.not.throw "invalid schema element 'value' requires type 'String,Function,Object' type was '<String>'"
  
  it 'should allow a function type', =>
    expect(-> new Schema( value:type:->)).to.not.throw "invalid schema element 'type' requires one of [String,Function,Object] type was \'<Function>\'"

  it 'should validate values', =>
    _S = new Schema elements: value: 'String'
    expect(_getter = _S.set('value', 'test').get).to.exist
    (_getter 'value').should.equal 'test'

  it 'should initialize from schema file', =>
    _s = require "./schemas/simple.json"
    expect(=> new Schema name: {type: "String", restrict: "^((?:(?:[^?+*{}()[\]\\|]+))$"}).to.throw "Regular Expression provided for 'name.restrict' was invalid"
    expect(=> new Schema _s).to.not.throw "type '<^[a-zA-Z-0-9_]+$>' for schema element 'name.restrict' was invalid"

  it 'should initialize from complex schema file', =>
    _s = require "./schemas/_loopback.json"
    (@schema = new Schema _s)
    
  it 'should check for required fields', =>
    _d =       
      name: 'Test'
    expect(@schema.set _d).to.eq "required property 'properties' is missing"
    
  it 'should check for valid properties', =>
    _d =       
      name: 'Test'
      properties: []
      foo: {}
    expect(@schema.set(_d) instanceof Schema).to.be.false
    expect(@schema.set(_d)).to.eq "element 'foo' is not a valid element"
    
  it 'should check for required fields on elements', =>
    _d =       
      name: 'Test'
      options:
        idInjection: true
      properties:
        foo:
          type: "String"
          required: true
    expect(@schema.set(_d) instanceof Schema).to.be.true
    # _d = Object.assign _d, properties:
      # type: "Boolean"
      # name: "Test"
    # expect(=> @schema.set _d).to.not.throw "required property 'type' is missing"

  it 'should set values on elements', =>
    (typeof (_opts = @schema.get 'options') == 'object').should.be.true
    (_opts.get 'idInjection').should.be.true

#         
  # it 'should set a value to the schema', =>
    # _s = require "./schemas/simple.json"
    # @schema = new Schema _s
    # ((@schema.set 'name', 'Test') instanceof Schema).should.be.true
# 
  # it 'should get a value from the schema', =>
    # (@schema.get 'name').should.equal 'Test'
