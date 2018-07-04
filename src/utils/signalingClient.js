import { Logger } from './utils'
import { EventEmitter } from 'events';

class SignalingClient {
    constructor(appid) {
        this.signal = Signal(appid);
        this.call_holding = null;
        this.call_active = null;
        this.channel = null;
        this.appid = appid;
        this.uid = null;
        this.events = new EventEmitter();
    }
    // 登录 session 是否成功连接
    login(account) {
        return new Promise((resolve, reject) => {
            Logger.log('Logging in ' + account);
            //starts login
            let session = this.signal.login(account, "_no_need_token");

            //if success
            session.onLoginSuccess = uid => {
                Logger.log('login success ' + uid);
                this.uid = uid;
                resolve();
            };

            //if fail
            session.onLoginFailed = ecode => {
                Logger.log('login failed ' + ecode);
                this.session = null;
                reject();
            };
            // 收到呼叫邀请回调
            session.onInviteReceived = (...args) => {this._onInviteReceived(...args)};
            this.session = session;
        });
    }

    call(channelName, peer, require_peer_online) {
        return new Promise((resolve, reject) => {
            let extra = {};

            if (require_peer_online) {
                extra["_require_peer_online"] = 1;
            }

            let extra_msg = JSON.stringify(extra);

            Logger.log('call ' + peer + ' , channelName : ' + channelName + ', extra : ' + extra_msg);
            // 该方法用于发起呼叫，即邀请某用户加入某个频道
            let call = this.session.channelInviteUser2(channelName, peer, extra_msg);
            //对方接受邀请回调
            call.onInviteAcceptedByPeer = extra => {
                this.call_active = this.call_holding;
                this.call_holding = null;
                this.join(call.channelName).then(() => {
                    Logger.log('call.onInviteAcceptedByPeer ' + extra);
                    resolve();
                });
            };
            //对方拒绝邀请回调
            call.onInviteRefusedByPeer = extra => {
                Logger.log(`call.onInviteRefusedByPeer ${extra}`);
                let status = JSON.parse(extra).status;
                reject({ reason: `Call refused. ${this.statusText(status)}` });
            };
            // 当呼叫失败时触发
            call.onInviteFailed = extra => {
                Logger.log(`call.onInviteFailed ${extra}`);
                reject({ reason: `Invite failed: ${JSON.parse(extra).reason}` });
            };
            // 当呼叫被对方结束时触发
            call.onInviteEndByPeer = (...args) => {this._onInviteEndByPeer(...args)};

            this.call_holding = call;
        });
    }

    join(channelName) {
        return new Promise((resolve, reject) => {
            Logger.log(`Joining channel ${channelName}`);
            // 准备加入频道
            let channel = this.session.channelJoin(channelName);
            //当加入频道成功时触发此回调
            channel.onChannelJoined = () => {
                Logger.log('channel.onChannelJoined');
                resolve();
            };
            // 当加入频道失败时触发此回调
            channel.onChannelJoinFailed = ecode => {
                Logger.log(`channel.onChannelJoinFailed ${ecode}`);
                reject(ecode);
            };

            this.channel = channel;
        });
    }
    // 当离开频道时触发此回调
    leave() {
          // alert('leave');

        // window.location.href = './meeting.html';
        let channel = this.channel;
        if (channel === null) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            channel.onChannelLeaved = () => {
                Logger.log('channel.onChannelLeaved');
                this.channel = null;
                resolve();
            };
            channel.channelLeave();
        });
    }

    acceptCall(call) {
        return new Promise((resolve, reject) => {
            this.call_active = this.call_holding;
            this.call_holding = null;

            // 接受来自 account 用户的加入指定频道的呼叫邀请

            this.join(call.channelName).then(() => {
                call.channelInviteAccept();
                // 邀请成功之后

                resolve({
                    peer: call.peer,
                    channelName: call.channelName
                });
            }).catch(err => {
                reject(err);
            });
        });
    }
    // 拒绝来自 account 用户的加入指定频道的呼叫邀请
    rejectCall(call, status) {
        status = status;
        // status = status || 0;
        call.channelInviteRefuse(JSON.stringify({ status: status }));
        if(status===0){
          // this.endCall(call, true);

            alert('您已经拒绝此次通话');
        window.location.href = './meeting.html'
            
            // $('#parent-wrapper').hide();
            // $('#daiji').show();
        }
          return Promise.resolve();
    }
// 我是主动方 -> 终止向 account 用户发送加入指定频道的邀请。终止成功后主叫方将收到 onInviteEndByMyself() 回调
    endCall(call, passive) {
        // call.onInviteEndByMyself = extra => {
        //     Logger.log('call.onInviteEndByMyself ' + extra);
        //     this.call_holding = (this.call_holding === call) ? null : this.call_holding;
        //     this.call_active = (this.call_active === call) ? null : this.call_active;
        //     this.leave();
        // };

        if (!passive) {
          // alert('end');
            // window.location.href = './meeting.html'
            call.channelInviteEnd();
        } else {
          // alertrt('end11');

            // window.location.href = './meeting.html'
            this.call_active = null;
            this.call_holding = null;
        }
        // 结束呼叫
        // window.location.href = './meeting.html'
        // $('#media-container').hide();
        // $('#metting').show();
        return Promise.resolve();
    }

    statusText(status) {
        switch (status) {
        case 0:
            return "Peer rejected.";
        case 1:
            return "Peer is busy.";
        }
    }

    on(event, callback) {
        this.events.on(event, callback);
    }

    //session events delegate
    _onInviteReceived(call) {
        Logger.log(`recv invite from ${call.peer}, ${call.channelName}, ${call.extra}`);

        //incoming call for accept or refuse
        // 收到呼叫邀请，如果“我”正在忙，会拒绝掉此次呼叫
        if (this.call_active !== null) {
            //busy
            this.rejectCall(call, 1);
        } else {
          // 对方已结束呼叫回调,收到对方呼叫，接入
            call.onInviteEndByPeer = (...args) => {this._onInviteEndByPeer(...args)};
            this.call_holding = call;
            this.events.emit("inviteReceived", call);
        }
    }

    //call events delegate
    _onInviteEndByPeer(extra) {
        Logger.log('call.onInviteEndByPeer ' + extra);
        this.events.emit("inviteEndByPeer");
    }
}

export default SignalingClient;