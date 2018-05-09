import {
    _object, _schemaHelpers,
} from "./_references";
import {
    makeClean, makeDirty,
    refAtKeyValidation, refValidation,
    getPatternPropertyDefaults
} from "./utils";
import {SchemaHelpers} from "./_schemaHelpers";
import {Model} from "./model";
import Notifiers from "./_branchNotifier";
import merge from "lodash.merge";

/**
 * @class PropertiesModel
 */
export class PropertiesModel extends Model {
    /**
     *
     */
    constructor() {
        super(arguments[0]);

        // stores SchemaHelpers reference for use
        _schemaHelpers.set(this, new SchemaHelpers(this));

        // sets Proxy Model reference on map
        _object.set(this, new Proxy(Model.createRef(this, {}), this.handler));
    }

    /**
     * Handler for Object Proxy Evaluation
     * @returns {{get: function, set: function}}
     */
    get handler() {
        const _self = this;
        return Object.assign(super.handler, {
            get: (t, key) => {
                return key === "$model" ? this : t[key];
            },
            set: (t, key, value) => {
                return setHandler(this, t, key, value);
            },
            deleteProperty: (t, key) => {
                // creates mock of future model state for evaluation
                let _o = Object.assign({}, this.model);
                delete _o[key];
                const _res = this.validate(_o);
                // validates model with value removed
                if (_res !== true) {
                    Notifiers.get(_self.rxvo).sendError(_self.jsonPath, _res);
                    return false;
                }

                // performs delete operation on model
                delete t[key];
                return true;
            }
        });
    }

    /**
     * todo: review for removal
     * utility method to create selector path
     * @param path
     * @param addr
     * @returns {string}
     */
    static concatPathAddr(path, addr) {
        return path.length ? `${path}/${addr}` : `${addr}`;
    }

    /**
     * todo: review for removal
     * Getter for patternDefaults for this Model
     * @returns {object|null}
     */
    get patternDefaults() {
        return getPatternPropertyDefaults(this.rxvo.getSchemaForPath(this.path));
    }

    /**
     * getter for object model
     */
    get model() {
        return _object.get(this);
    }

    /**
     * setter for object model
     * @param value
     */
    set model(value) {
        // fails on attempts to set scalar value
        // or if this node is locked or fails validation
        if ((typeof value) !== "object" || this.isFrozen) {
            return false;
        }

        if (refValidation(this, value) !== true) {
            Notifiers.get(this.rxvo).sendError(this.jsonPath, this.rxvo.errors);
            return false;
        }

        if (!this.isDirty) {
            // marks model as dirty to prevent cascading validation calls
            makeDirty(this);
        }

        // defines new Proxy Object for data modeling
        // todo: replace proxy with Object Delegation
        _object.set(this,
            new Proxy(Model.createRef(this, {}), this.handler));
        Object.keys(value).forEach((k) => {
            // -- added try/catch to avoid error in JSFiddle
            try {
                this.model[k] = value[k];
            } catch (e) {
                // marks model as clean
                makeClean(this);

                // sends notifications
                Notifiers.get(this.rxvo).sendError(this.jsonPath, e.message);
                return false;
            }
        });

        // marks model as in sync with tree
        makeClean(this);

        // // calls next's observable to update subscribers
        if (!this.isDirty) {
            Notifiers.get(this.rxvo).sendNext(this.jsonPath);
        }

        return true;
    }

    /**
     * @param {string} key
     * @returns {any}
     */
    get(key) {
        return this.model[key];
    }

    /**
     * sets value to schema key
     * @param {string|object} key
     * @param {any} value
     */
    set(key, value) {
        // attempts validation of value against schema
        if (!refAtKeyValidation(this, key, value)) {
            return false;
        }

        if (!this.isDirty) {
            // marks model as dirty to prevent cascading validation calls
            makeDirty(this);
        }

        // applies validated value to model
        this.model[key] = value;

        // updates observers
        Notifiers.get(this.rxvo).sendNext(this.jsonPath);

        // removes dirtiness
        makeClean(this);

        return this;
    }
}

/**
 * Negotiates Key values that are Objects
 * @param model
 * @param key
 * @returns {boolean}
 */
const handleObjectKey = (model, key) => {
    const _sH = _schemaHelpers.get(model);
    const e = _sH.setObject(key);
    if (typeof e === "string") {
        makeClean(model);
        Notifiers.get(model.rxvo).sendError(model.jsonPath, e);
        return false;
    }

    return true;
};

/**
 * Creates Model Child to set up Proxy Object
 * @param model
 * @param key
 * @param value
 * @returns {*}
 */
const createModelChild = (model, key, value) => {
    const _sH = _schemaHelpers.get(model);
    // calls validate with either full path if in PropertiesModel or key if nested in ItemsModel
    value = _sH.setChildObject(key, value);
    if ((typeof value) === "string") {
        // marks model as clean
        makeClean(model);
        // sends notifications
        Notifiers.get(model.rxvo).sendError(model.jsonPath, value);
        return false;
    }
    return value;
};

/**
 * Parameter Set trap for Proxy
 * @param model
 * @param t
 * @param key
 * @param value
 * @returns {boolean}
 */
const setHandler = (model, t, key, value) => {
    if (key in Object.prototype) {
        // do nothing against proto props
        return true;
    }

    // -- ensures we aren't in a frozen hierarchy branch
    if (model.isFrozen) {
        return false;
    }

    // checks for branch update status
    if (!model.isDirty) {
        let _o = Object.assign({}, t);
        _o[key] = value;
        // attempts validation of value update
        if (refValidation(model, _o) !== true) {
            makeClean(model);
            Notifiers.get(model.rxvo).sendError(model.jsonPath, model.rxvo.errors);
            return false;
        }
    }

    // console.log(`setting key: ${key}`);
    // if key is type 'object', we will set directly
    if (typeof key === "object") {
        return handleObjectKey(model, key);
    }

    if ((typeof value) === "object") {
        if ((value = createModelChild(model, key, value)) === false) {
            return false
        }
    }

    // performs the operation on Model
    t[key] = value;
    return true;
};
