(async function() {
    try {
        var r = await signInWithEmail('67612186@qq.com', 'adonis0940');
        if (r && r.user) {
            window.__loginResult = 'OK: ' + r.user.email;
            window.currentUser = r.user;
            return window.__loginResult;
        } else {
            return 'FAIL: ' + (r ? JSON.stringify(r) : 'null result');
        }
    } catch(e) {
        return 'ERR: ' + e.message;
    }
})()
