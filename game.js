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

var player, press, monster_tick, show, bullets, monsters, eat_sound, death_sound, paused,
    terrain, viewport, raw_pixeldata, monster_rate, time, tick;

function removeDead(objects) {
    for (i in objects) {
        if (objects[i].dead) {
            objects.splice(i, 1); // remove element
        }
    }
}

function clockString(time) {
    var seconds = time % 60;
    var minutes = parseInt(time/60) % 60;
    var hours = parseInt(time/3600);

    var sstring = seconds.toString();
    var mstring = minutes.toString();
    var hstring = hours.toString();
    if (sstring.length < 2) { sstring = "0" + sstring };
    if (mstring.length < 2) { mstring = "0" + mstring };
    if (hstring.length < 2) { hstring = "0" + hstring };
    return hstring + ":" + mstring + ":" + sstring;
    //return hstring;
}

var Game = function () {
    var shoot = function () {
        var vx = Math.sin(Math.PI*(player.ang+0*player.dir)/180) * 3;
        var vy = Math.cos(Math.PI*(player.ang+0*player.dir)/180) * 3;
        var new_bullet = new jaws.Sprite({
            image: "bullet.png", x: player.x, y: player.y
        });
        new_bullet.vx = vx;
        new_bullet.vy = vy;
        bullets.push(new_bullet);
    };

    var newMonster = function (x, y) {
        var monster = new jaws.Sprite({image: "monster.png", x: x, y: y, anchor: "center"});
        monster.speed = 1;
        monster.move_chance = 0.5;
        monster.move = function () {
            var chance = this.move_chance;
            if (terrainInRect(this.rect())) {
                chance = this.move_chance / 2;
            }
            if (Math.random() > chance) {
                return;
            }
            var vx = parseInt(Math.random() * 2) * this.speed;
            var vy = parseInt(Math.random() * 2) * this.speed;
            if (player.x > this.x) {
                this.x += vx;
            } else {
                this.x -= vx;
            }
            if (player.y > this.y) {
                this.y += vy;
            } else {
                this.y -= vy;
            }
        };
        return monster;
    }

    this.setup = function () {
        eat_sound = jaws.assets.get(afile("eat"));
        death_sound = jaws.assets.get(afile("ble"));
        music = jaws.assets.get(afile("bu-tense-and-jealous"));

        //music.loop = true;
        //music.play();

        monster_tick = 0;
        time = 0;
        tick = 0;
        monster_rate = 30;

        bullets = [];
        monsters = [];

        player = new jaws.Sprite({image: "player.png", x: 200, y: 200, anchor: "center"});
        player.dir = 1;
        player.ang = 0;
        player.radius = 0;
        player.max_radius = 20;
        player.speed = 0;
        player.max_speed = 7;
        player.accel = 0;
        player.max_accel = 1;
        player.power = 0;
        player.max_power = 20;

        center = {x: player.x, y: player.y};

        terrain = new jaws.Sprite({image: "arena.png", x: 0, y: 0});
        viewport = new jaws.Viewport({max_x: terrain.width, max_y: terrain.height});
        raw_pixeldata = getRawData(terrain);

        jaws.on_keyup("space", function () {
           press = true; 
        });
        jaws.on_keyup("p", function () {
            if (!paused) {
                jaws.game_loop.pause();
                paused = true;
            } else {
                jaws.game_loop.unpause();
                paused = false;
            }
        });

        player.update = function () {
            if (press) {
                press = false;
                //player.radius = 2;
                player.dir = -player.dir;
                player.speed = 0;
                player.accel = 0;

                if (player.power == player.max_power) {
                    player.radius = 9;
                    //player.dir = -player.dir;
                    shoot();
                } else {
                    center.x = player.x;
                    center.y = player.y;
                    player.radius = 0;
                }
                player.power = 0;
            }
            if (jaws.pressed("space")) {
                player.speed += player.accel;
                player.accel += 0.05
                if (player.speed > player.max_speed) {
                    player.speed = player.max_speed;
                }
                player.power += 1;
                if (player.power > player.max_power) {
                    player.power = player.max_power;
                }
                //player.radius = 8;
            }
            if (player.radius < player.max_radius) {
                player.radius += 1;
            }
            player.ang = (player.ang + 360 + player.speed * player.dir) % 360;
            player.angle = -player.ang;
            player.x = Math.sin(Math.PI*player.ang/180) * player.radius + center.x;
            player.y = Math.cos(Math.PI*player.ang/180) * player.radius + center.y;
            
        };

    };

    this.update = function () {
        if (tick >= 60) {
            tick = 0;
            time++;
        }
        if (monster_tick == 0) {
            monsters.push(newMonster(50, 50));
            monsters.push(newMonster(400, 400));
            monsters.push(newMonster(400, 50));
            monsters.push(newMonster(50, 400));
        }

        player.update();
        viewport.centerAround(center);

        for (i in bullets) {
            bullets[i].x += bullets[i].vx;
            bullets[i].y += bullets[i].vy;
        }
        for (i in monsters) {
            monsters[i].move();
        }

        var monster_hits = jaws.collideOneWithMany(player, monsters);
        if (monster_hits.length) {
            eat_sound.play();
            jaws.switchGameState(Game);
            return;
        }

        if (terrainInRect(player.rect())) {
            eat_sound.play();
            jaws.switchGameState(Game);
            return;
        }

        var hits = jaws.collideManyWithMany(bullets, monsters);
        for (i in hits) {
            hits[i][0].dead = true;
            hits[i][1].dead = true;
            death_sound.play();
        }
        removeDead(bullets);
        removeDead(monsters);

        monster_tick = (monster_tick + 1) % (60 * monster_rate);
        tick++;
    };

    this.draw = function () {
        jaws.clear();

        viewport.apply(function () {
            terrain.draw();
            player.draw();
            jaws.context.strokeStyle = "rgb(255,255,255)";
            jaws.context.lineWidth = 4;
            jaws.context.beginPath();
            jaws.context.moveTo(center.x,center.y);
            jaws.context.lineTo(player.x, player.y);
            jaws.context.stroke();
            for (i in bullets) {
                bullets[i].draw();
            }
            for (i in monsters) {
                monsters[i].draw();
            }
        });

        jaws.context.lineWidth = 2;
        jaws.context.strokeStyle = "rgb(255,255,255)";
        if (player.power == player.max_power) {
            jaws.context.strokeStyle = "rgb(255,0,0)";
        }
        jaws.context.strokeRect(10, 10, player.power*5, 10);
        jaws.context.fillStyle = "rgb(255,255,255)";
        jaws.context.fillText(clockString(time), 128, 10);
    };

};

jaws.onload = function () {
    jaws.assets.add([
        "player.png",
        "bullet.png",
        "monster.png",
        "arena.png",
        afile("eat"),
        afile("ble"),
        afile("bu-tense-and-jealous"),
    ]);
    jaws.start(Game, {fps: 60});
};
