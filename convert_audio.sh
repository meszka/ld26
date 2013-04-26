#!/bin/bash
for file_it in *it; do
    file=${file_it%.it}
    mplayer -ao pcm:fast:file=${file}.wav ${file}.it
done

#for file_mid in *.mid; do
#    file=${file_mid%.mid}
#    timidity ${file}.mid -Ow -o ${file}.wav
#done

for file_wav in *.wav; do
    file=${file_wav%.wav}
    lame -V0 -h -b 160 --vbr-new ${file}.wav ${file}.mp3
    oggenc ${file}.wav
done
