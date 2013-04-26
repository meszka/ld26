function getAudioFormat() {
    var audio = new Audio();
    if (audio.canPlayType('audio/mpeg')) {
        return "mp3";
    } else if (audio.canPlayType('audio/ogg; codecs="vorbis"')) {
        return "ogg";
    } else {
        return "wav";
    }
}

var AUDIO_FORMAT = getAudioFormat();

function afile(name) {
    return name + "." + AUDIO_FORMAT;
}

function getRawData(sprite) {
    var canvas_context = sprite.asCanvasContext();
    return canvas_context.getImageData(0, 0, sprite.width, sprite.height).data;
}

function terrainAt(x, y) {
    x = parseInt(x);
    y = parseInt(y);
    try {
        return raw_pixeldata[(y * terrain.width * 4) + (x * 4) + 3];
    } catch (e) {
        return false;
    }
}

function terrainInRect(rect) {
    for (var x = rect.x; x < rect.right; x++) {
        for (var y = rect.y; y < rect.bottom; y++) {
            if (terrainAt(x, y)) {
                return true;
            }
        }
    }
    return false;
}

// ===========================================================================

var Game = function () {

    this.setup = function () {
    };

    this.update = function () {
    };

    this.draw = function () {
        jaws.clear();
    };

};

jaws.onload = function () {
    jaws.assets.add([
    ]);
    jaws.start(Game);
};
