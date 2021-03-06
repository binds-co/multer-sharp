'use strict';

const crypto = require('crypto');
const gcloud = require('@google-cloud/storage');
const sharp = require('sharp');
const includes = require('array-includes');
const { lookup } = require('mime-types');
const chalk = require('chalk');

class MulterSharp {
  constructor(options) {
    const gcOptions = {};
    gcOptions.bucket = options.bucket || process.env.GCS_BUCKET || null;
    gcOptions.projectId = options.projectId || process.env.GCLOUD_PROJECT || null;
    gcOptions.keyFilename = options.keyFilename || process.env.GCS_KEYFILE || null;

    if (!options.bucket) {
      throw new Error('You have to specify bucket for Google Cloud Storage to work.');
    }

    if (!options.projectId) {
      throw new Error('You have to specify project id for Google Cloud Storage to work.');
    }

    if (!options.keyFilename) {
      throw new Error('You have to specify credentials key file for Google Cloud Storage to work.');
    }

    this.options = Object.assign({}, MulterSharp.defaultOptions, options || {});
    this.getFilename = this.options.filename || getFilename;

    if (typeof options.destination === 'string') {
      this.getDestination = ($0, $1, cb) => cb(null, options.destination);
    } else {
      this.getDestination = options.destination || getDestination;
    }

    this.gcStorage = gcloud({
      projectId: gcOptions.projectId,
      keyFilename: gcOptions.keyFilename
    });

    this.gcsBucket = this.gcStorage.bucket(gcOptions.bucket);
  }

  _handleFile(req, file, cb) {
    this.getDestination(req, file, (destErr, destination) => {
      if (destErr) cb(destErr);

      this.getFilename(req, file, (fileErr, filename) => {
        if (fileErr) cb(fileErr);

        const fileOptions = {
          predefinedAcl: this.options.acl,
          metadata: {
            contentType: getFormat(this.options.format) || file.mimetype
          }
        };
        const gcName = typeof destination === 'string' && destination.length > 0 ? `${destination}/${filename}` : filename;
        const gcFile = this.gcsBucket.file(gcName);

        file.stream
          .pipe(transformer(this.options))
          .on('info', (info) => {
            /* eslint-disable no-console */
            console.info(chalk.green(`Image format is ${info.format}, Image height is ${info.height}, & Image width is ${info.width}`));
            console.info(chalk.magenta(JSON.stringify(info)));
          })
          .on('error', (transformErr) => cb(transformErr))
          .pipe(gcFile.createWriteStream(fileOptions))
          .on('error', (gcErr) => cb(gcErr))
          .on('finish', () => {
            const uri = encodeURI(`https://storage.googleapis.com/${this.options.bucket}/${gcName}`);
            return cb(null, {
              mimetype: getFormat(this.options.format) || file.mimetype,
              path: uri,
              filename
            });
          });
      });
    });
  }

  _removeFile(req, file, cb) {
    this.getDestination(req, file, (destErr, destination) => {
      if (destErr) cb(destErr);
      const gcName = typeof destination === 'string' && destination.length > 0 ? `${destination}/${file.filename}` : file.filename;
      const gcFile = this.gcsBucket.file(gcName);
      gcFile.delete(cb);
    });
  }
}

MulterSharp.defaultOptions = {
  acl: 'private',
  resize: true,
  crop: false,
  background: false,
  embed: false,
  max: false,
  min: false,
  withoutEnlargement: false,
  ignoreAspectRatio: false,
  extract: false,
  trim: false,
  flatten: false,
  extend: false,
  negate: false,
  rotate: false,
  flip: false,
  flop: false,
  blur: false,
  sharpen: false,
  gamma: false,
  grayscale: false,
  greyscale: false,
  normalize: false,
  normalise: false,
  withMetadata: false,
  convolve: false,
  threshold: false,
  toColourspace: false,
  toColorspace: false
};

function getDestination(req, file, cb) {
  cb(null, '');
}

function getFilename(req, file, cb) {
  crypto.pseudoRandomBytes(16, (err, raw) => {
    cb(err, err ? undefined : raw.toString('hex'));
  });
}

function transformer(options) {
  let imageStream = sharp();

  if (options.resize && options.size) {
    imageStream = imageStream.resize(options.size.width, options.size.height, options.size.option);
  }

  if (options.background) {
    imageStream = imageStream.background(options.background);
  }

  if (options.crop && Object.prototype.hasOwnProperty.call(sharp.gravity, options.crop)) {
    imageStream = imageStream.crop(sharp.gravity[options.crop]);
  }

  if (options.embed) {
    imageStream = imageStream.embed();
  }

  if (options.max) {
    imageStream = imageStream.max();
  }

  if (options.min) {
    imageStream = imageStream.min();
  }

  if (options.withoutEnlargement) {
    imageStream = imageStream.withoutEnlargement();
  }

  if (options.ignoreAspectRatio) {
    imageStream = imageStream.ignoreAspectRatio();
  }

  if (options.extract) {
    imageStream = imageStream.extract(options.extract);
  }

  if (options.trim) {
    imageStream = imageStream.trim(parseInt(options.trim, 10));
  }

  if (options.flatten) {
    imageStream = imageStream.flatten();
  }

  if (options.extend) {
    imageStream = imageStream.extend(options.extend);
  }

  if (options.negate) {
    imageStream = imageStream.negate();
  }

  if (includes([0, 90, 180, 270], options.rotate)) {
    imageStream = imageStream.rotate(options.rotate);
  }

  if (options.flip) {
    imageStream = imageStream.flip();
  }

  if (options.flop) {
    imageStream = imageStream.flop();
  }

  if (options.blur) {
    imageStream = imageStream.blur(options.blur);
  }

  if (options.sharpen) {
    imageStream = imageStream.sharpen(options.sharpen);
  }

  if (options.gamma) {
    imageStream = imageStream.gamma(options.gamma);
  }

  if (options.grayscale || options.greyscale) {
    imageStream = imageStream.greyscale();
  }

  if (options.normalize || options.normalise) {
    imageStream = imageStream.normalise();
  }

  if (options.convolve) {
    imageStream = imageStream.convolve(options.convolve);
  }

  if (options.threshold) {
    imageStream = imageStream.threshold(options.threshold);
  }

  if (options.toColourspace || options.toColorspace) {
    imageStream = imageStream.toColourspace(options.toColourspace || options.toColorspace);
  }

  if (options.withMetadata) {
    imageStream = imageStream.withMetadata(options.withMetadata);
  }

  if (options.format) {
    if (typeof options.format === 'object' && Object.prototype.hasOwnProperty.call(options.format, 'type') && Object.prototype.hasOwnProperty.call(options.format, 'option')) {
      imageStream = imageStream.toFormat(options.format.type, options.format.option);
    } else {
      imageStream = imageStream.toFormat(options.format);
    }
  }

  return imageStream;
}

function getFormat(format) {
  if (typeof format === 'object' && Object.prototype.hasOwnProperty.call(format, 'type')) {
    return lookup(format.type);
  }
  return lookup(format);
}

module.exports = (options) => new MulterSharp(options);
