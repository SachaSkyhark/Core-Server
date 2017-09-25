//import $ from 'jquery';
import { mergePost } from '../common/init.js';

require('bootstrap-notify');

$.fn.serializeObject = function()
{
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

class FormPoster
{
    constructor()
    {
        const _this = this;
        this.events = {
            'api-progress': this.handleApiProgress,
            'api-prepare':  this.handleApiPrepare,
            'api-error':    this.handleApiError,
            'api-success':  this.handleApiSuccess,
            'api-done':     this.handleApiDone
        };

        $(document).off('submit', 'form');
        $(document).on('submit', 'form', function(e)
        {
            if(!$(this).attr('action'))
                return;

            e.preventDefault();
            _this.handleFormSubmit(this);
        });
    }

    handleApiError(form, data)
    {
        var msg = "An error occured while processing your request";
        const err = data.error;

        if(typeof(err) == 'object' || typeof(err) == "array")
        {
            if(typeof(err.error) == 'string')
                msg = err.error;
        }
        else if(typeof(err) == "string")
            msg = err;

        $.notify({ message: msg },{ type: 'danger' });
    }

    handleApiSuccess(form, data)
    {
        const that= $(form);
        const msg = data.result;

        if(that.attr('SuccessMessage'))
           return $.notify(that.attr('SuccessMessage'), 'success');

        if(typeof(msg) == 'string')
            return $.notify(msg, 'success');

        if(typeof(msg) == 'object')
        {
            if(typeof(msg.result) == 'string')
                return $.notify(msg.result, 'success');
        }

        return $.notify(msg, 'Data successfully updated!');
    }

    handleApiPrepare(form, data)
    {
        $(form).find('input, textarea, select, button').not(':disabled').attr('disabled', true).attr('predisabled', true);

        //ToDo: set loader icon
    }

    handleApiProgress(form, data)
    {
        //ToDo set progress in button
    }

    handleApiDone(form)
    {
        $(form).find('[predisabled]').removeAttr('disabled').removeAttr('predisabled');
    }

    trigger(elm, eventName, data)
    {
        try
        {
            const secondName = eventName.replace(/-\S*/g, function(txt){ return txt.charAt(1).toUpperCase() + txt.substr(2).toLowerCase();});

            if(secondName !== eventName)
            {
                if(!this.trigger(elm, secondName, data))
                    return;
            }

            //------------------------------------------------------------------------

            var event; // The custom event that will be created

            if (document.createEvent) {
                event = document.createEvent("HTMLEvents");
                event.initEvent(eventName, true, true);
            } else {
                event = document.createEventObject();
                event.eventType = eventName;
            }

            event.eventName = eventName;

            for(var key in data)
                event[key] = data[key];

            if (document.createEvent)
                elm.dispatchEvent(event);
            else
                elm.fireEvent("on" + event.eventType, event);

            if(event.defaultPrevented)
                return false;
        }
        catch(e)
        {
            console.error(e);
        }

        try
        {
            if(this.events[eventName])
                this.events[eventName].call(this, elm, data);
        }
        catch(e)
        {
            console.error(e);
        }

        return true;
    }

    handleFormSubmit(elm)
    {
        const _this = this;
        const api   = $(elm).attr('action');
        var that = $(elm);
        var data = null;

        //that.trigger('api-before-submit', elm);
        _this.trigger(elm, 'api-before-submit', { api: api });

        if(that.find('input[type="file"]:not([disabled])').length > 0)
        {
            that.attr('enctype', 'multipart/form-data');
            data = new FormData(elm);
        }
        else
        {
            that.attr('enctype', 'application/json');
            data = that.serializeObject();
            data = JSON.stringify( mergePost(data) );
        }

        $.event.global.ajaxError = false;

        $.ajax({
            url: '/api/'+api,
            type: 'POST',
            global: false,
            xhr: function()
            {
                var myXhr = $.ajaxSettings.xhr();
                if(myXhr.upload){ // Check if upload property exists
                    myXhr.upload.addEventListener('progress',function(p)
                    {
                        const progress = Math.round(p.position * 100 / p.totalSize, 3);
                        _this.trigger(elm, 'api-progress', { progress: progress, progressEvent: p, api: api });
                    }, false);
                }
                return myXhr;
            },
            beforeSend: function()
            {
                _this.trigger(elm, 'api-prepare', { api: api });
            },
            success: function(e)
            {
                if(typeof(e) != 'object')
                {
                    try
                    {
                        e = JSON.parse(e);
                    }
                    catch(e)
                    {
                        _this.trigger(elm, 'api-error', { api: api, result: { error: 'An internal conversion error occured' }, error: 'An internal conversion error occured' });
                        return;
                    }
                }

                if(e.error)
                {
                    _this.trigger(elm, 'api-error', { error: e.error, result: e, api: api });
                }
                else
                {
                    _this.trigger(elm, 'api-success', { api: api, result: e });
                }

                _this.trigger(elm, 'api-done', { api: api, result: e });
            },
            error: function(err)
            {
                if(err.responseText)
                {
                    try
                    {
                        const json = JSON.parse(err.responseText);
                        const res =  { result: json, api: api, error: json.error };

                        _this.trigger(elm, 'api-error', res);
                        _this.trigger(elm, 'api-done',  res);
                        return;
                    }
                    catch(e)
                    {
                        _this.trigger(elm, 'api-error', { result: err, error: err.responseText, api: api });
                        _this.trigger(elm, 'api-done', { result: err, error: err.responseText, api: api });
                        return;
                    }
                }

                _this.trigger(elm, 'api-error', { result: err, error: err, api: api });
                _this.trigger(elm, 'api-done',  { result: err, error: err, api: api });
            },
            data: data,
            cache: false,
            contentType: that.attr('enctype'),
            processData: false
        });
    }
}

if(!FormPoster.shared)
    FormPoster.shared = new FormPoster();

export default FormPoster.shared;