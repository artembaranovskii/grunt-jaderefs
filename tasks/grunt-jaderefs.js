/*
 * grunt-contrib-jaderefs
 * http://gruntjs.com/
 *
 * Copyright (c) 2013 Baranovskiy Artem
 * email: abaranovskiy@yandex.ru
 * Licensed under the MIT license.
 */
module.exports = function (grunt) {

    'use strict';

    var _ = grunt.util._

        , path = require('path')
        , crypto = require('crypto')

    // Start build pattern
    //- build:[type] destination
        , regexBuild = /\/\/-*\s*build:(\w+)\s*(.+)\s*/

    // End build pattern
    //- endbuild
        , regexEnd = /\/\/-*\s*endbuild\s*/

    // Assets pattern
        , regExpAssets = /(href|src)=["']([^'"]+)["']/;


    grunt.registerMultiTask('jaderefs', "Replaces references to non-optimized scripts or stylesheets on JADE files", function () {
        var files = grunt.file.expand(this.data.src)
            , params = _.extend({}, this.options(), this.data);

        files.map(grunt.file.read).forEach(function (content, i) {
            content = content.toString(); // get string content
            var blocks = getBlocks(content);

            var file = files[i];
            grunt.log.subhead('processjade - ' + file);

            // Determine the linefeed from the content
            var lf = /\r\n/g.test(content) ? '\r\n' : '\n';

            blocks.forEach(function (block) {
                // Determine the indent from the content
                var raw = block.raw.join(lf);

                var replacement = jaderefsTemplate[block.type](block, params, lf);
                content = content.replace(raw, replacement);
            });

            // Write new file content
            grunt.file.write(file, content);

            grunt.log.writeln('File "' + file + '" handled.');
        });
    });

    // Block types for inserting assets links
    var jaderefsTemplate = {

        css: function (block, params, lf) {
            var indent = (block.raw[0].match(/^\s*/) || [])[0];

            // Prepare blocks
            prepareAssets(block, params);

            return indent + grunt.template.process('link(rel="stylesheet", href="//#{baseUrl}<%= dest%>")', {data: block});
        },

        js: function (block, params, lf) {
            var indent = (block.raw[0].match(/^\s*/) || [])[0];

            // Prepare blocks
            prepareAssets(block, params);

            return indent + grunt.template.process('script(type="text/javascript", src="//#{baseUrl}<%= dest%>")', {data: block});
        },

        remove: function (block) {
            return ''; // removes replaces with nothing
        }
    };

    /**
     * Returns array of all finded directive for jade
     * example:
     *
     * [{
 	 *   type: 'css',
     *   dest: '/css/site.css',
     *   src: [ '/css/normalize.css', '/css/main.css' ],
     *   raw: [ '    //- build:css /css/site.css',
     *          '    link(rel="stylesheet", href="/css/normalize.css")
     *          '    link(rel="stylesheet", href="/css/main.css")
     *          '    //- endbuild'
     *        ]
     *  },
     *  {
     *    type: 'js',
     *    dest: '/js/site.js',
     *    src: [ '/js/plugins.js', '/js/main.js' ],
     *    raw: [ '    //- build:js js/site.js',
     *           '    script(src="/js/plugins.js")
	 *           '    script(src="/js/main.js")
     *           '    //- endbuild'
     *         ]
     * }]
     */
    function getBlocks(content) {

        // Get array string of content
        var lines = content.replace(/\r\n/g, '\n').split(/\n/)
            , block = false
            , sections = {}
            , last;

        lines.forEach(function (l) {
            var build = l.match(regexBuild)
                , endbuild = regexEnd.test(l);

            if (build) {
                block = true;
                // create a random key to support multiple removes
                var key = build[2].length > 1 ? build[2] : (Math.random(1, 2) * Math.random(0, 1));
                sections[[build[1], key.toString().trim()].join(':')] = last = [];
            }

            // switch back block flag when endbuild
            if (block && endbuild) {
                last.push(l);
                block = false;
            }

            if (block && last) {
                last.push(l);
            }
        });

        var blocks = [];

        for (var s in sections) {
            if (sections.hasOwnProperty(s)) {
                blocks.push(fromSectionToBlock(s, sections[s]));
            }
        }

        return blocks;
    }

    /**
     * Parse assets sections and gets needed data: block type, source path, destination path.
     *
     * @param {string} key
     * @param {Array} section
     * @return {Object}
     */
    function fromSectionToBlock(key, section) {

        var chunks = key.split(':')
            , src = []
            , assets;

        for (var i = 1, len = section.length - 1; i < len; i++) {
            assets = section[i].match(regExpAssets);

            if (assets && assets[2]) {
                src.push(assets[2]);
            }
        }

        return {
            type: chunks[0],
            dest: chunks[1],
            raw: section,
            src: src
        };
    }

    /**
     * Prepare assets (at now only concatinate)
     *
     * @param block
     * @param options
     */
    function prepareAssets(block, options) {
        options = _.defaults(options || {}, {
            separator: grunt.util.linefeed
        });

        // Concatinate assets
        var combined = block.src ? block.src.map(function (filepath) {
            // Get relative path to assets
            filepath = '/' + path.relative(options.assets.basePath||'', filepath);

            return grunt.file.read(options.assets.src + filepath);
        }).join(grunt.util.normalizelf(options.separator)) : '';

        // Calcuate file hash for versioning
        var hash = crypto.createHash('md5');
        hash.update(combined);
        var filehash = hash.digest('hex');

        // Create new path to assets
        block.dest = block.dest.replace(new RegExp('([.]' + block.type + ')'), filehash + '$1');
        grunt.file.write((options.assets.tmp || options.assets.dest) + block.dest, combined);
    }
};