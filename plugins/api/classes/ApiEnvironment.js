const request    = require('request-promise');

/**
* ApiEnvironment
* @property siteManager {Class}
* @property name {String}
* @property session {Object}
* @property sessionObject {Class}
* @property cookie {Object}
* @property post {Object}
* @property file {Object} Posted files
* @property database {Class}
* @property is_local {Boolean}
* @property client_ip {String}
* @property queryVars {Object}
*/
class ApiEnvironment
{
    constructor(options)
    {
        for (var key in options)
            this[key] = options[key];
    }

    /**
    * Replace the session data for the connected user
    * @param data {Object}
    */
    setSessionData(data)
    {
        //Overwrited by constructor opionts
    }

    /**
    * Replace the cookies of the connected user
    * @param data {Object}
    */
    setCookieData(data)
    {
        //Overwrited by constructor opionts
    }

    /**
    * Call an api from the environment
    * @param name {String}
    * @param post {Object}
    */
    api(name, post)
    {
        post = post || this.post;
        return this.sessionObject.api(name, post, this.client_ip, this.file, this.$get);
    }

    //----------------------------------------------------
    //Additional environment functions

    /**
    * Check if a given variable is numeric or not
    * @param value {String|Number}
    */
    is_numeric(name)
    {
        return !isNaN(Number(name));
    }

    /**
    * Check if a checkbox with the given name has been checked ot not in the post
    * @param input_name {String}
    */
    is_checked(name)
    {
        return this.post[name] === true || this.post[name] === 'on';
    }

    /**
    * Check if a variable value matches the required type
    * @param value {String}
    * @param type {String} string|numeric|positive|positive+|array|object|no|email|username|password-difficulty
    */
    check_varvalue(val, type)
    {
        switch (type)
        {
        case 'string':
            return typeof (val) === 'string' || typeof (val) === 'number';
            break;
        case 'numeric':
            return this.is_numeric(val);
            break;
        case 'positive':
            return this.is_numeric(val) && val >= 0;
            break;
        case 'positive+':
            return this.is_numeric(val) && val > 0;
            break;
        case 'array':
            return Array.isArray(val);
            break;
        case 'object':
            return typeof (val) === 'object';
            break;
        case 'no':
            return true;
            break;
        case 'email':
            const mvalidator = require('email-validator');
            return mvalidator.validate(val);
        case 'username':
            var regex = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*$/;
            return regex.test(val);
        case 'password-difficulty':
            var regex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.{7,})/;
            return regex.test(val);
            //case 'action_id':
            //    return preg_match("/([A-Z]{3})-([0-9]{3})\s/", $var.' ');
            //    break;
        }
    }

    /**
    * Check if a variable of the post with the given name matches the required type
    * @param input_name {String}
    * @param type {String} string|numeric|positive|positive+|array|object|no|email|username|password-difficulty
    */
    check_vartype(name, type)
    {
        if (!this.isset(name))
            return false;

        if (!this.check_varvalue(this.post[name], type))
            return false;

        return true;
    }

    /**
    * Check if multiple variables of the post exists and optionally check their types
    */
    check_variables()
    {
        function iterateList(lst)
        {
            for (var key in lst)
            {
                if (this.is_numeric(key) == false && (typeof (key) === 'string' || typeof (key) === 'number'))
                {
                    if (!this.check_vartype(key, lst[key]))
                    {
                        throw('Variable ' + key + ' has a wrong type (needed: ' + lst[key] + ')');
                    }
                }
                else if (typeof (lst[key]) === 'string')
                {
                    if (!this.isset(lst[key]))
                    {
                        throw('Variable ' + lst[key] + ' not found');
                    }
                }
                else if (typeof (lst[key]) === 'array' || typeof (lst[key]) === 'object')
                {
                    if (!iterateList.call(this, lst[key]))
                        return false;
                }
            }

            return true;
        }

        return iterateList.call(this, arguments);
    }

    /**
    * Check if a variable exists in the post
    */
    isset(varname)
    {
        return (this.post[varname] !== undefined);
    }


    /**
    * Upload on secure way images
    * @param name {String} the name of the post variable
    * @param destination {String} the destination filename
    */
    uploadImage(name, destination)
    {
        var data = this.post[name];
        /**
            Ref:
                https://www.owasp.org/index.php/Protect_FileUpload_Against_Malicious_File#Case_n.C2.B03:_Images

            Description :
                Une image peut contenir du code (e.g. ImageTragick). Le MIME / Content-Type et l'extension pouvant être falsifiés,
                une manière efficace de vérifier une image reçue est de tout simplement l'interpreter à l'aide d'une librairie
                editeur d'images et de resize l'image pour ensuite revenir à sa taille d'origine. L'image est réécrite.

            Extra:
                La fonction procède également à une vérification des premiers 4400 bytes afin de trouver le magic number correspondant
                à un MIME type. On vérifie s'il correspond au prétendu MIME type du fichier.
        **/

        const jimp       = require("jimp");
        const imageSize  = require("image-size");
        const fileType   = require("file-type");

        return new Promise(function(resolve, reject) {
            data = data.replace(/^data:image\/\w+;base64,/, '');
            data = Buffer.from(data, 'base64');

            if(!fileType(data).mime.toString().toLowerCase().includes("image")) {
                reject("Magic MIME number fault");
            }

            var dimensions = imageSize(data);

            jimp.read(data, function(err, img) {
                if (err) {
                    reject(err);
                }
                else
                {
                    /**
                        Image is subject to slight quality reduction here
                    **/
                    img.resize(dimensions.width - 1, dimensions.height -1, jimp.RESIZE_NEAREST_NEIGHBOR);
                    img.resize(dimensions.width, dimensions.height, jimp.RESIZE_NEAREST_NEIGHBOR);

                    img.write(destination , function(err, res) {
                       if(err) {
                           reject(err);
                       } else {
                           resolve(res);
                       }
                    });
                }
            });
        });
    }

    /**
    * Remove an object from the CDN and locally memory
    * @param file_name {String}
    */
    purgeCache(name)
    {
        this.siteManager.purgeCache(name);
    }

    /**
    * Get http request
    * @param url {String}
    */
    httpGet(url)
    {
        return request({
            uri: url,
            json: true,
            method: 'GET'
        });
    }

    /**
    * Post http request
    * @param url {String}
    * @param data {Object}
    */
    httpPost(url, data)
    {
        return request({
            uri: url,
            json: true,
            method: 'POST',
            body: data
        });
    }

}

module.exports = ApiEnvironment;