
import datetime
import json
import tornado.web
import tornado.websocket

class PingHandler(tornado.web.RequestHandler):
    def get(self):
        now = datetime.datetime.utcnow()
        self.set_header('Content-Type', 'application/json')
        self.set_header('Cache-Control', 'no-cache')
        self.set_header('Date', now)
        self.set_header('Expires', now)
        self.write(json.dumps({"ping": "pong"}))

class WSPingHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        pass

    def on_message(self, message):
        req = json.loads(message)
        if req['mtype'] != 'ping':
            self.write_message({'response': 'error', 'errorDesc': 'Unsupported message type'})
            return
        pong = {'mtype': 'pong', 'rmid': req['mid']}
        self.write_message(pong)

    def on_close(self):
        pass
