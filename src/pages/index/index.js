import $ from 'jquery';
import 'bootstrap-material-design/dist/css/bootstrap-material-design.min.css';
import 'bootstrap-material-design';

import '../../assets/css/main.css';

$(() => {
      window.location.href = `meeting.html?account=2969594`;
// window.location.href = `/web/admin/toMeeting?account=123`;
    // $("#join-meeting").click(function (e) {
    //     //join btn clicked
    //     e.preventDefault();
    //     var account = parseInt($("#account-name").val());
    //     if (account && !isNaN(account)) {
    //         //account has to be a non empty numeric value
    //         window.location.href = `meeting.html?account=${account}`;
    //     } else {
    //         $("#account-name").removeClass("is-invalid").addClass("is-invalid");
    //     }
    // });
});