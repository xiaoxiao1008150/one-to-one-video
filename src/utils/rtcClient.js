import AgoraRTC from 'agora-rtc-sdk'
import $ from 'jquery'
import {Logger} from './utils'

class RtcClient {
    constructor(appid) {
        this.appid = appid;
        this.rtc = AgoraRTC.createClient({ mode: 'interop' });
        this.localStream = null;
        this.uid = null;
        this.remoteStreams = [];
        this.videoProfile = "360P_6 ";
        this.dynamicKey = null;
        this.published = false;
        this.muted = false;
        // 不需要window.resize 视频窗口的大小 暂时拿掉
        // this.subscribeWindowResizeEvent();
        this.subscribeStreamEvents();
    }

    //life cycle
    init(channelName, autoPublish) {
        return new Promise((resolve, reject) => {

            let appid = this.appid;
            let client = this.rtc;
            // 加入 AgoraRTC 频道 (join)
            this.getDynamicKey(channelName).then(key => {
                client.init(appid, () => {
                    client.join(key, channelName, undefined, uid => {
                        let options = {
                            streamID: uid,
                            audio: true,
                            video: true,
                            screen: false
                        };
                        this.uid = uid;

                        // 创建音视频流对象
                        let localStream = AgoraRTC.createStream(options);
                        // 设置视频属性
                        localStream.setVideoProfile(this.videoProfile);
    
                        this.localStream = localStream;
                        localStream.init(() => {

                            this.rearrangeStreams();
                            if (autoPublish) {
                                client.publish(localStream);
                            }
                            // 接受邀请的流成功后,隐藏接收界面
                            // alert('接受')
                            // $('#parent-wrapper').show();
                            $('#metting').hide();
                            $('#media-container').show();
                            resolve(localStream);
                        });
                    }, err => {
                        reject(err);
                    });
                });
            });
        });
    }


    end() {
        let client = this.rtc;
        let localStream = this.localStream;

        if (localStream === null) {
            return Promise.resolve();
        }

        this.clearStreams();

        if (this.published) {
            client.unpublish(this.localStream);
            this.published = false;
        }
        localStream.close();
        this.localStream = null;

        this.remoteStreams = [];

        return new Promise((resolve, reject) => {
            client.leave(() => {
                resolve();
            }, () => {
                reject();
            });
        });
    }

    applyMute() {
        let localStream = this.localStream;

        if (localStream !== null) {
            if (this.muted) {
              // 禁用音频轨道
                localStream.disableAudio();
            } else {
              // 启用音频轨道
                localStream.enableAudio();
            }
        }
    }
// 切换音频轨道
    toggleMute() {
        this.muted = !this.muted;
        this.applyMute();
    }

    //events
    subscribeWindowResizeEvent() {
        let videoSize;
        $(window).resize(() => {
            videoSize = this.calculateStreamSize();
            if (this.localStream !== null) {
                this.resizeStream(this.localStream, videoSize);
            }
        });
    }

    subscribeStreamEvents() {
        let client = this.rtc;
        client.on('stream-added', evt => {
            var stream = evt.stream;
            Logger.log("New stream added: " + stream.getId());
            Logger.log("Timestamp: " + Date.now());
            Logger.log("Subscribe ", stream);
            client.subscribe(stream, function (err) {
                Logger.log("Subscribe stream failed", err);
            });
        });

        client.on('peer-leave', evt => {
            Logger.log("Peer has left: " + evt.uid);
            Logger.log("Timestamp: " + Date.now());
            Logger.log(evt);

            this.removeRemoteStream(evt.uid);
            this.rearrangeStreams();
        });

        client.on('stream-subscribed', evt => {
            var stream = evt.stream;
            Logger.log("Got stream-subscribed event");
            Logger.log("Timestamp: " + Date.now());
            Logger.log("Subscribe remote stream successfully: " + stream.getId());
            Logger.log(evt);
            this.addRemoteStream(stream);
            this.rearrangeStreams();
        });

        client.on("stream-removed", evt => {
            var stream = evt.stream;
            Logger.log("Stream removed: " + evt.stream.getId());
            Logger.log("Timestamp: " + Date.now());
            Logger.log(evt);
            this.removeRemoteStream(stream.getId());
            this.rearrangeStreams();
        });

        client.on('stream-published', () => {
            this.published = true;
        });
    }

    rearrangeStreams() {
        let remoteStreams = this.remoteStreams;
        let localStream = this.localStream;
        this.clearStreams();

        if (localStream === null) {
            return;
        }

        Logger.log(`Rearranging streams, local:${localStream.getId()}, remote: ${remoteStreams.length === 0 ? "NONE" : remoteStreams[0].id}`);
        // 本地stream
        this.displayStream($("#stream-side"), localStream, "fullscreen", 'local');

        if (remoteStreams.length === 0) {
            // this.displayStream($("#media-container"), localStream, "fullscreen");
            // this.displayStream($("#stream-main"), localStream, "fullscreen");
        // 远程 stream
        } else if (remoteStreams.length === 1) {
            // this.displayStream($("#media-container"), remoteStreams[0].stream, "fullscreen");
            this.displayStream($("#stream-main"), remoteStreams[0].stream, "fullscreen");
            // this.displayStream($("#media-container"), localStream, "side");
        }
        // 显示关闭按钮
        $('#m-close').show();
    }

    //utils
    clearStreams() {
        $("[role=stream]").remove();
    }

    addRemoteStream(stream) {
        this.remoteStreams.push({
            stream: stream,
            id: stream.getId()
        });
    }

    removeRemoteStream(streamId) {
        this.remoteStreams = this.remoteStreams.filter(item => {
            return item.id !== streamId;
        });
    }
// 设置流的宽高
    resizeStream(stream, size) {

        $("#" + stream.getId()).css({
            width: `${size.width}px`,
            height: `${size.height}px`
        });
    }

    displayStream(container, stream, mode,flag) {
        // cleanup, if network connection interrupted, user cannot receive any events.
        // after reconnecting, the same node id is reused,
        // so remove html node with same id if exist.
        $(`#${stream.getId()}`).remove();
        container.append(`<div id="${stream.getId()}" class="${stream === this.localStream ? "agora-local" : "agora_remote"}" role="stream" data-stream-id="${stream.getId()}"></div>`);

        if (mode === "fullscreen") {
          // 如果是本地流 local
            let size = this.calculateStreamSize();
            if(flag ==='local'){
              size.width = '32%';
              size.height = '200px';
            }else{
              size.width = '65%';
            }
            $("#" + stream.getId()).css({
                // width: `${size.width}`,
                height: `${size.height}`
            });
        } else {
            $("#" + stream.getId()).removeClass("side-stream").addClass("side-stream");
            $("#" + stream.getId()).css({
                width: `160px`,
                height: `120px`
            });
        }
        stream.play(stream.getId());
    }

    getDynamicKey(channelName) {
        // if dynamic not enabled
        return Promise.resolve(undefined);

        // if dynamic key enabled
        // return $.ajax({
        //     url: 'service url to get your dynamic key'
        // })
    }

    getResolutionArray(reso) {
        switch (reso) {
        case "120p":
            return [160, 120];
        case "240p":
            return [320, 240];
        case "360p":
            return [640, 360];
        case "480p":
            return [640, 480];
        case "720p":
            return [1280, 720];
        case "1080p":
            return [1920, 1080];
        default:
            return [1280, 720];
        }
    }

    calculateStreamSize() {
        let viewportWidth = $(window).width(),
            viewportHeight = $(window).height(),
            curResolution = this.getResolutionArray(this.videoProfile),
            width,
            height,
            newWidth,
            newHeight,
            ratioWindow,
            ratioVideo;


        width = viewportWidth - 100;
        height = viewportHeight - 80;
        ratioWindow = width / height;
        ratioVideo = curResolution[0] / curResolution[1];
        if (ratioVideo > ratioWindow) {
            // calculate by width
            newWidth = width;
            newHeight = width * curResolution[1] / curResolution[0];
        } else {
            // calculate by height
            newHeight = height;
            newWidth = height * curResolution[0] / curResolution[1];
        }

        newWidth = Math.max(newWidth, 160);
        newHeight = Math.max(newHeight, 120);
        return {
            width: newWidth,
            height: newHeight
        };
    }
}

export default RtcClient;