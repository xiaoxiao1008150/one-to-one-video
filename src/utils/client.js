import SignalingClient from './signalingClient';
import RtcClient from './rtcClient';
import { Howl } from 'howler';
import $ from 'jquery';
import { Logger, Message } from './utils'

class Client {
    //construct a meeting client with signal client and rtc client
    constructor(appid) {
        this.appid = appid;
        this.channelName = Math.random() * 10000 + "";
        // this.channelName = '1000';
        this.signal = new SignalingClient(appid);
        this.rtc = new RtcClient(appid);

        //ring tones resources
        this.sound_ring = new Howl({
            src: [require('../assets/media/basic_ring.mp3')],
            loop: true
        });

        this.sound_tones = new Howl({
            src: [require('../assets/media/basic_tones.mp3')],
            loop: true
        });

        this.signal.on("inviteReceived", call => {this.onInviteReceived(call)});
        this.signal.on("inviteEndByPeer", () => {this.onInviteEndByPeer()});

        this.subscribeEvents();
    }

    init(localAccount) {
        // localAccount = '客服代表01';
        localAccount = '2969594';
        return this.signal.login(localAccount);
    }


    //return a promise resolves a remote account name
    requestRemoteAccount() {
        return new Promise((resolve) => {
            let dialog = $(".remoteAccountModal");
            let localAccount = this.localAccount;

            dialog.find(".callBtn").off("click").on("click", () => {
                let accountField = dialog.find(".remoteAccountField");
                //dialog confirm
                let account = accountField.val();

                if (!account) {
                    accountField.siblings(".invalid-feedback").html("Valid account should be a non-empty numeric value.")
                    accountField.removeClass("is-invalid").addClass("is-invalid");
                } else if (`${account}` === `${localAccount}`) {
                    accountField.siblings(".invalid-feedback").html("You can't call yourself.")
                    accountField.removeClass("is-invalid").addClass("is-invalid");
                } else {
                    $(".startCallBtn").hide();
                    dialog.modal('hide');
                    resolve(account);
                }
            });

            //start modal
            dialog.modal({ backdrop: "static", focus: true });
        });
    }

    //return a promise resolves a signaling call result
    // 主动发起呼叫的时候 调用的函数
    call(channelName, account, requirePeerOnline) {
        return new Promise((resolve, reject) => {
            // let dialog = $(".callingModal");
            // dialog.find(".callee").html(account);
            let signal = this.signal;

            signal.call(channelName, account, requirePeerOnline).then(() => {
                // dialog.modal('hide');
                resolve();
            }).catch(err => {
                Message.show(err.reason);
                reject();
            });
        });
    }

    //end given call object, passive means the call is ended by peer
    // 结束呼叫
    endCall(call, passive) {
        let signal = this.signal;
        let rtc = this.rtc;
        // let btn = $(".toolbar .muteBtn");

        // $(".startCallBtn").show();

        rtc.muted = true;
        // btn.removeClass("btn-info").addClass("btn-secondary");
        // btn.find("i").html("mic");
        //end rtc
        rtc.end();
        //end signal call
        signal.endCall(call, passive);
        return Promise.resolve();
    }

    //ring when calling someone else
    ringCalling(play) {
        if (play) {
            this.sound_ring.play();
        } else {
            this.sound_ring.stop();
        }
    }
    //ring when being called by someone else
    ringCalled(play) {
        if (play) {
            this.sound_tones.play();
        } else {
            this.sound_tones.stop();
        }
    }

    //events
    subscribeEvents() {
        let signal = this.signal;
        // 刷新或者手动关闭浏览器页面的时候 还没测试
        window.addEventListener("beforeunload", function (e) {
            this.ringCalling(false);
            this.endCall(signal.call_active || signal.call_holding, false);
        });
        // 点击 “关闭” 视频按钮的时候，调用结束函数 endCall
       $("#m-close").off("click").on("click", () => {
            this.ringCalling(false);
            this.endCall(signal.call_active || signal.call_holding, false);
            window.location.href = './meeting.html';
        });

        //toolbar mute btn
        // 主动方 “静音”按钮
        $(".toolbar .muteBtn").off("click").on("click", e => {
            let btn = $(e.currentTarget);
            let rtc = this.rtc;
            // 切换静音状态
            rtc.toggleMute();
            if (rtc.muted) { // 静音的class
                btn.removeClass("btn-secondary").addClass("btn-info");
                btn.find("i").html("mic_off");
            } else { // 非静音的class
                btn.removeClass("btn-info").addClass("btn-secondary");
                btn.find("i").html("mic");
            }
        });
// 点击‘开始视频’ 按钮，发起 呼叫
        $(".startCallBtn").off("click").on("click", () => {
            let channelName = this.channelName;
            // this.requestRemoteAccount 是否是合理的可以呼叫的账号 remoteAccount
            this.requestRemoteAccount().then(remoteAccount => {
                //start calling via signal
                if (remoteAccount !== "") {
                    this.ringCalling(true);
                    this.rtc.init(channelName, false).then(stream => {
                        this.call(channelName, remoteAccount, true).then(() => {
                            this.ringCalling(false);
                            // 呼叫成功 发布流
                            this.rtc.rtc.publish(stream);
                        }).catch(() => {
                            this.ringCalling(false);
                            // 失败 结束呼叫
                            this.endCall(signal.call_active || signal.call_holding, false);
                        });
                    }).catch(() => {
                        this.ringCalling(false);
                        this.endCall(signal.call_active || signal.call_holding, false);
                    });
                }
            });
        });
    }

    //delegate callback when receiving call
    // 收到对方呼叫成功接入之后的回调函数
    onInviteReceived(call) {
      console.log('+++++++++++',call)
        // 切换页面显示
        $('#parent-wrapper').show();
        $('#daiji').hide();
        let dialog = $(".calledModal");
        let signal = this.signal;
        let rtc = this.rtc;
        // 将对方的信息写入页面相应的html 中
        dialog.find(".caller").html(call.peer);
        // 拒绝对方
        let flag = true;
        dialog.find(".declineBtn").off("click").on("click", () => {
            dialog.modal('hide');
            this.ringCalled(false);
            // 信令拒绝
            if(flag){
              signal.rejectCall(call, 0);
              flag = false;
            }
        });
        // 接受邀请
        dialog.find(".acceptBtn").off("click").on("click", () => {
          // 弹窗框隐藏
            // dialog.modal('hide');
            // 页面的 “发起呼叫” 按钮隐藏
            // $(".startCallBtn").hide();
            this.ringCalled(false);
            // 信令接受邀请
            signal.acceptCall(call).then(call => {
                rtc.init(call.channelName, true);

            }).catch(err => {
                Logger.log(`Accept call failed: ${err}`);
            });
        });

        this.ringCalled(true);
        // dialog.modal({ backdrop: "static" });
    }

    //delegate callback called when call end by peer
    // 对方结束呼叫，
    onInviteEndByPeer() {
        let signal = this.signal;
        // alert('结束')
        // 弹框隐藏
        $(".calledModal").modal('hide');
        this.ringCalled(false);
        // 结束呼叫
        this.endCall(signal.call_active || signal.call_holding, true);
        window.location.href = './meeting.html'
    }
}

export default Client;