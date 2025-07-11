import { startServer } from './src/server.js'

const port = parseInt(process.env.PORT || '3001')
startServer(port) 