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
    monster_interval, monster_rate, time, tick, bullet_speed, kills,
    health_crates, health_interval, health_rate, health_tick, best_time;

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
}

function randomSpawnPoint(r) {
    var angle = Math.random() * 2 * Math.PI;
    var map_center = {x: terrain.width/2, y: terrain.height/2}
    var radius = r || 360;
    return {x: radius * Math.cos(angle) + map_center.x,
            y: radius * Math.sin(angle) + map_center.y};
}

function endGame() {
    jaws.switchGameState(GameOver);
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
        if (terrainInRect(this.rect()) || this.x < 0 || this.x > terrain.width
                || this.y < 0 || this.y > terrain.height) {
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
    var anim = new jaws.Animation({sprite_sheet: "explosion2.png",
        frame_size: [20, 20],
        frame_duration: 100,
    });
    var explosion = new jaws.Sprite({x: x, y: y, anchor: "center"});
    explosion.width = 20;
    explosion.height = 20;
    explosion.anim = anim;
    return explosion;
}

function newHealth(x, y) {
    var health = new jaws.Sprite({image: "health.png", x: x, y: y, anchor: "center"});
    if (jaws.collideOneWithMany(health, health_crates).length) {
        return null;
    }
    return health;
}

var Game = function () {
    var shoot = function () {
        var vx = Math.sin(Math.PI*(player.ang+0*player.dir)/180) * bullet_speed;
        var vy = Math.cos(Math.PI*(player.ang+0*player.dir)/180) * bullet_speed;
        var new_bullet = new jaws.Sprite({
            image: "bullet.png", x: player.x, y: player.y, anchor: "center"
        });
        new_bullet.vx = vx;
        new_bullet.vy = vy;
        new_bullet.angle = player.angle;
        bullets.push(new_bullet);
        shoot_sound.play();
    };

    this.setup = function () {
        //eat_sound = jaws.assets.get(afile("eat"));
        //death_sound = jaws.assets.get(afile("ble"));
        explosion_sound = jaws.assets.get(afile("explosion"));
        hurt_sound = jaws.assets.get(afile("hurt"));
        get_sound = jaws.assets.get(afile("get"));
        shoot_sound = jaws.assets.get(afile("shoot"));
        
        //music = jaws.assets.get(afile("bu-tense-and-jealous"));
        //music.loop = true;
        //music.play();

        terrain = new jaws.Sprite({image: "arena_big.png", x: 0, y: 0});
        terrain.r = 200;
        terrain.g = 0;
        terrain.b = 0;
        terrain.color = 0;

        viewport = new jaws.Viewport({max_x: terrain.width, max_y: terrain.height});
        raw_pixeldata = getRawData(terrain);

        monster_tick = 0;
        health_tick = 0;
        time = 0;
        tick = 0;
        kills = 0;
        monster_interval = 15;
        monster_rate = 3;
        health_interval = 30;
        health_rate = 1;
        bullet_speed = 4;

        bullets = [];
        monsters = [];
        explosions = [];
        health_crates = [];

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
        player.hp = 5;
        player.max_hp = 5;
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
                endGame();
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
            }
            if (player.radius < player.max_radius) {
                player.radius += 1;
            }
            player.ang = (player.ang + 360 + player.speed * player.dir) % 360;
            player.angle = 360 - player.ang;
            player.x = Math.sin(Math.PI*player.ang/180) * player.radius + center.x;
            player.y = Math.cos(Math.PI*player.ang/180) * player.radius + center.y;
            
        };
        
        player.hit = function () {
            if (!this.stunned) {
                this.hp -= 1; 
                hurt_sound.play();
                //eat_sound.play();
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
            if (health_tick == 0) {
                for (var i = 0; i < health_rate; i++) {
                    var health = null;
                    while (health === null) {
                        var spawn = randomSpawnPoint(155);
                        health = newHealth(spawn.x, spawn.y);
                    }
                    health_crates.push(health);
                }
            }
            health_tick = (health_tick + 1) % health_interval;
        }
        if (monster_tick == 0) {
            for (var i = 0; i < monster_rate; i++) {
                var monster = null;
                while (monster === null) {
                    var spawn = randomSpawnPoint();
                    monster = newMonster(spawn.x, spawn.y);
                }
                monsters.push(monster);
            }
            monster_rate++;
        }

        player.update();
        viewport.centerAround(center);
        //viewport.forceInsideVisibleArea(center, 50);

        for (i in bullets) {
            bullets[i].x += bullets[i].vx;
            bullets[i].y += bullets[i].vy;
            if (bullets[i].x < 0 || bullets[i].x > terrain.width || bullets[i].y <
                    0 || bullets[i].y > terrain.height) {
                bullets[i].dead = true;
            }
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

        if (terrainInRect(player.rect()) || player.x < 0 || player.x >
                terrain.width || player.y < 0 || player.y > terrain.height) {
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

        var health_hits = jaws.collideOneWithMany(player, health_crates);
        for (i in health_hits) {
            health_hits[i].dead = true;
            player.hp += 2;
            if (player.hp > player.max_hp) player.hp = player.max_hp;
            get_sound.play();
        }

        removeDead(bullets);
        removeDead(monsters);
        removeDead(explosions);
        removeDead(health_crates);

        terrain.color = (terrain.color + 1) % 120;
        terrain.g = parseInt(50 + 50*Math.sin((terrain.color/120)*Math.PI*2));

        monster_tick = (monster_tick + 1) % (60 * monster_interval);
        tick++;
    };

    this.draw = function () {
        jaws.clear();
        //jaws.context.webkitImageSmoothingEnabled = false;
        //jaws.context.mozImageSmoothingEnabled = false;

        viewport.apply(function () {
            //terrain.draw();
            jaws.context.save();
            terrain.draw();
            //var terrain_canvas = terrain.asCanvas();
            //jaws.context.drawImage(terrain_canvas, 0, 0);
            jaws.context.globalCompositeOperation = "source-in";
            jaws.context.fillStyle = "rgb(" + terrain.r + "," + terrain.g
                                            + "," + terrain.b + ")";
            jaws.context.fillRect(0, 0, terrain.width, terrain.height);
            jaws.context.restore();


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
            for (i in health_crates) {
                health_crates[i].draw();
            }
        });

        jaws.context.lineWidth = 2;
        jaws.context.strokeStyle = "rgb(255,255,255)";
        if (player.power == player.max_power) {
            jaws.context.strokeStyle = "rgb(255,0,0)";
        }
        jaws.context.strokeRect(10, 10, player.power* 100/player.max_power, 10);

        jaws.context.strokeStyle = "rgb(0,255,0)";
        jaws.context.strokeRect(10, 25, player.hp * 100/player.max_hp, 10);

        jaws.context.font = "14px monospace";
        jaws.context.fillStyle = "rgb(255,255,255)";
        jaws.context.fillText(clockString(time), jaws.width - 180, 20);
        jaws.context.fillText("KILLS: " + kills.toString(), jaws.width - 90, 20);
    };

};

var Title = function () {
    this.setup = function () {
        jaws.on_keyup("space", function () {
            jaws.switchGameState(Game); 
        });
    };

    this.draw = function () {
        jaws.clear();
        jaws.context.fillStyle = "rgb(0,0,0)";
        jaws.context.fillRect(0, 0, jaws.width, jaws.height);
        jaws.context.fillStyle = "rgb(255,255,255)";
        jaws.context.font = "26px monospace";
        jaws.context.fillText("Single-button Survivor", 25, 90);
        jaws.context.font = "20px monospace";
        jaws.context.fillText("The space bar is your friend.", 25, 150);
        jaws.context.fillText("Tap to move.", 25, 180);
        jaws.context.fillText("Hold to rotate.", 25, 210);
        jaws.context.fillText("Release to shoot.", 25, 240);
        jaws.context.fillText("Press space to begin.", 25, 310);
    };
};

var GameOver = function () {

    var game_over_tick;
    var wait = 1.5;
    var prev_best_time;

    this.setup = function () {
        game_over_tick = 0;
        prev_best_time = best_time;
    };

    this.update = function () {
        if (game_over_tick >= 60 * wait) {
            jaws.on_keyup("space", function () {
                jaws.switchGameState(Game);
            });
        } else {
            game_over_tick++;
        }

        if (time > prev_best_time) {
            best_time = time;
            if (typeof(Storage)!=="undefined") {
                localStorage.best_time = time;
            }
        }
    };
    
    this.draw = function () {
        jaws.clear();
        jaws.context.fillStyle = "rgb(0,0,0)";
        jaws.context.fillRect(0, 0, jaws.width, jaws.height);
        jaws.context.fillStyle = "rgb(255,255,255)";
        jaws.context.font = "60px monospace";
        jaws.context.fillText("GAME OVER", 40, 100);
        jaws.context.font = "20px monospace";
        jaws.context.fillText("Survival time: " + clockString(time), 50, 150);
        jaws.context.fillText("Kills: " + kills.toString(), 150, 180);

        if (time > prev_best_time) {
            jaws.context.fillText("New highscore!", 113, 240);
            jaws.context.fillText("Previous best time: " + clockString(prev_best_time), 35, 270);

        } else {
            jaws.context.fillText("Best time: " + clockString(prev_best_time), 75, 250);
        }


        if (game_over_tick >= 60 * wait) {
            jaws.context.fillText("Press space to try again.", 50, 350);
        }
    };
};

jaws.onload = function () {
    jaws.assets.add([
        "player.png",
        "bullet.png",
        "monster.png",
        //"monster3.png",
        "arena_big.png",
        //"explosion.png",
        "explosion2.png",
        "health.png",
        //afile("eat"),
        //afile("ble"),
        afile("explosion"),
        afile("hurt"),
        afile("get"),
        afile("shoot"),
        //afile("bu-tense-and-jealous"),
    ]);

    if (typeof(Storage) !== "undefined") {
        best_time = localStorage.best_time || 0;
    } else {
        best_time = 0;
    }

    jaws.start(Title, {fps: 60});
};
