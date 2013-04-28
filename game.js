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

var player, press, monster_tick, show, bullets, monsters, eat_sound,
    death_sound, explosion_sound, paused, terrain, viewport, raw_pixeldata,
    monster_interval, monster_rate, time, tick, bullet_speed, kills;

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

function randomSpawnPoint(radius) {
    var angle = Math.random() * 2 * Math.PI;
    var map_center = {x: terrain.width/2, y: terrain.height/2}
    radius = radius || 315;
    return {x: radius * Math.cos(angle) + map_center.x,
            y: radius * Math.sin(angle) + map_center.y};
}

function gameOver() {
    jaws.switchGameState(Game);
}

function newMonster(x, y) {
    var monster = new jaws.Sprite({image: "monster.png", x: x, y: y, anchor: "center"});
    if (jaws.collideOneWithMany(monster, monsters).length) {
        return null;
    }
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

        var old_x = this.x;
        var old_y = this.y;

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

        if (jaws.collideOneWithMany(this, monsters).length) {
            this.x = old_x;
            this.y = old_y;
        }
    };
    return monster;
}

function newExplosion(x, y) {
    var anim = new jaws.Animation({sprite_sheet: "explosion.png",
        frame_size: [20, 20],
        frame_duration: 100});
    var explosion = new jaws.Sprite({x: x, y: y});
    explosion.width = 20;
    explosion.height = 20;
    explosion.anim = anim;
    return explosion;
}

var Game = function () {
    var shoot = function () {
        var vx = Math.sin(Math.PI*(player.ang+0*player.dir)/180) * bullet_speed;
        var vy = Math.cos(Math.PI*(player.ang+0*player.dir)/180) * bullet_speed;
        var new_bullet = new jaws.Sprite({
            image: "bullet.png", x: player.x, y: player.y
        });
        new_bullet.vx = vx;
        new_bullet.vy = vy;
        bullets.push(new_bullet);
    };

    this.setup = function () {
        eat_sound = jaws.assets.get(afile("eat"));
        death_sound = jaws.assets.get(afile("ble"));
        explosion_sound = jaws.assets.get(afile("explosion"));
        hurt_sound = jaws.assets.get(afile("hurt"));
        music = jaws.assets.get(afile("bu-tense-and-jealous"));

        terrain = new jaws.Sprite({image: "arena.png", x: 0, y: 0});
        viewport = new jaws.Viewport({max_x: terrain.width, max_y: terrain.height});
        raw_pixeldata = getRawData(terrain);


        //music.loop = true;
        //music.play();

        monster_tick = 0;
        time = 0;
        tick = 0;
        kills = 0;
        monster_interval = 20;
        monster_rate = 3;
        bullet_speed = 4;

        bullets = [];
        monsters = [];
        explosions = [];

        var player_pos = randomSpawnPoint(155);
        player = new jaws.Sprite({image: "player.png", x: player_pos.x, y:
            player_pos.y, anchor: "center"});
        player.dir = 1;
        player.ang = Math.random() * 360;
        player.radius = 0;
        player.max_radius = 20;
        player.speed = 0;
        player.max_speed = 7;
        player.accel = 0;
        player.max_accel = 1;
        player.power = 0;
        player.max_power = 20;
        player.hp = 10;
        player.max_hp = 10;
        player.stunned = 0;

        center = {x: player.x, y: player.y};

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
            if (this.hp <= 0) {
                gameOver();
            }
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
        
        player.hit = function () {
            if (!this.stunned) {
                this.hp -= 1; 
                hurt_sound.play();
                this.stunned = 1;
            }
        };

    };

    this.update = function () {
        if (tick >= 60) {
            tick = 0;
            time++;
            if (player.stunned) {
                player.stunned--;
            }
        }
        if (monster_tick == 0) {
            //monsters.push(newMonster(50, 50));
            //monsters.push(newMonster(400, 400));
            //monsters.push(newMonster(400, 50));
            //monsters.push(newMonster(50, 400));
            for (var i = 0; i < monster_rate; i++) {
                var monster = null;
                while (monster === null) {
                    var spawn = randomSpawnPoint();
                    monster = newMonster(spawn.x, spawn.y);
                }
                monsters.push(newMonster(spawn.x, spawn.y));
            }
            monster_rate++;
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
        for (i in explosions) {
            if (explosions[i].anim.atLastFrame()) {
                explosions[i].dead = true;
            } else {
                explosions[i].setImage(explosions[i].anim.next());
            }
        }

        var monster_hits = jaws.collideOneWithMany(player, monsters);
        if (monster_hits.length) {
            //eat_sound.play();
            player.hit();
            //jaws.switchGameState(Game);
            //return;
        }

        if (terrainInRect(player.rect())) {
            player.hit();
            //jaws.switchGameState(Game);
            //return;
        }

        var hits = jaws.collideManyWithMany(bullets, monsters);
        for (i in hits) {
            hits[i][0].dead = true;
            hits[i][1].dead = true;
            kills++;
            explosions.push(newExplosion(hits[i][1].x, hits[i][1].y));
            explosion_sound.play();
        }
        var explosion_hits = jaws.collideManyWithMany(explosions, monsters);
        for (i in explosion_hits) {
            var monster_x = explosion_hits[i][1].x;
            var monster_y = explosion_hits[i][1].y;
            explosions.push(newExplosion(monster_x, monster_y));
            explosion_sound.play();
            explosion_hits[i][1].dead = true;
            kills++;
        }


        removeDead(bullets);
        removeDead(monsters);
        removeDead(explosions);

        monster_tick = (monster_tick + 1) % (60 * monster_interval);
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
            for (i in explosions) {
                explosions[i].draw();
            }
        });

        jaws.context.lineWidth = 2;
        jaws.context.strokeStyle = "rgb(255,255,255)";
        if (player.power == player.max_power) {
            jaws.context.strokeStyle = "rgb(255,0,0)";
        }
        jaws.context.strokeRect(10, 10, player.power*5, 10);

        jaws.context.strokeStyle = "rgb(0,255,0)";
        jaws.context.strokeRect(10, 25, player.hp * 5, 10);

        jaws.context.font = "14px monospace";
        jaws.context.fillStyle = "rgb(255,255,255)";
        jaws.context.fillText(clockString(time), jaws.width - 180, 20);
        jaws.context.fillText("KILLS: " + kills.toString(), jaws.width - 90, 20);
    };

};

jaws.onload = function () {
    jaws.assets.add([
        "player.png",
        "bullet.png",
        "monster.png",
        "arena.png",
        "explosion.png",
        afile("eat"),
        afile("ble"),
        afile("explosion"),
        afile("hurt"),
        //afile("bu-tense-and-jealous"),
    ]);
    jaws.start(Game, {fps: 60});
};
