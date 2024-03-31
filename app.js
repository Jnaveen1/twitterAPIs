const express = require('express')
const app = express()
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

app.use(express.json())
const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server is running....')
    })
  } catch (e) {
    console.log(e.message)
    process.exit(1)
  }
}
initializeDBAndServer()

const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'jhvhvbjb', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}
//API 1
app.post('/register/', async (request, response) => {
  console.log('hi')
  const {username, password, name, gender} = request.body
  console.log(username)
  console.log(name)
  console.log(gender)
  const query = `
  SELECT * FROM user WHERE username  = '${username}';
  `
  const checkUser = await db.get(query)
  if (checkUser === undefined) {
    const lengthpassword = `${password}`.length
    if (lengthpassword < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      console.log(password)
      const hashedPassword = await bcrypt.hash(request.body.password, 10)
      const query1 = `
      INSERT INTO user(name, username, password, gender)
      VALUES(
        '${name}',
        '${username}',
        '${hashedPassword}',
        '${gender}'
      )
      `
      const result = await db.run(query1)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})
//API 2
app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const query = `
  select * from user where username = '${username}';
  `
  const checkUser = await db.get(query)
  if (checkUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const checkPassword = await bcrypt.compare(password, checkUser.password)
    if (checkPassword === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'jhvhvbjb')
      if (jwtToken === undefined) {
        response.status(401)
        response.send('Invalid Token')
      } else {
        response.status(200)
        response.send({jwtToken: jwtToken})
      }
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
//API 3
app.get('/user/tweets/feed/', authentication, async (request, response) => {
  console.log(request.username)
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query = `
  SELECT 
    user.username  AS username, 
    T.tweet AS tweet,
    T.date_time 
  FROM (follower INNER JOIN tweet 
    ON follower.following_user_id = tweet.user_id) AS T
    INNER JOIN user ON user.user_id = T.following_user_id 
  WHERE follower.follower_user_id = '${userId}'
  ORDER BY date_time DESC
  LIMIT 4  
  `
  const result = await db.all(query)
  response.send(
    result.map(each_tweet => {
      return {
        username: each_tweet.username,
        tweet: each_tweet.tweet,
        dateTime: each_tweet.date_time,
      }
    }),
  )
})
//API 4
app.get('/user/following/', authentication, async (request, response) => {
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query = `
  SELECT 
  user.name 
  FROM user INNER JOIN follower 
  ON user.user_id = follower.following_user_id  
  WHERE follower.follower_user_id = '${userId}'
  `
  const result = await db.all(query)
  response.send(
    result.map(each => {
      return {
        name: each.name,
      }
    }),
  )
})
//API 5
app.get('/user/followers/', authentication, async (request, response) => {
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query = `
  SELECT user.name
  FROM user INNER JOIN follower 
  ON user.user_id = follower.follower_user_id 
  WHERE follower.following_user_id = '${userId}' ;
  `
  const result = await db.all(query)
  response.send(
    result.map(each => {
      return {
        name: each.name,
      }
    }),
  )
})
//API 6
app.get('/tweets/:tweetId/', authentication, async (request, response) => {
  const {tweetId} = request.params
  let arr = []
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query = `
  SELECT *
  FROM user INNER JOIN follower 
  ON user.user_id = follower.follower_user_id 
  WHERE follower.following_user_id = '${userId}' ;
  `
  const result = await db.all(query)
  result.map(each => {
    arr.push(each.user_id)
  })
  console.log(arr)
  // const query2 = `
  // SELECT
  // tweet.tweet ,
  // COUNT(DISTINCT(like.like_id)) AS likes ,
  // COUNT(DISTINCT(reply.reply_id)) AS replies ,
  // tweet.date_time AS dateTime
  // FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
  // INNER JOIN like ON tweet.tweet_id = like.tweet_id
  // WHERE tweet.user_id = '${userId}' AND
  // GROUP BY tweet.tweet_id
  // `
  // const result = await db.all(query2)
  // response.send(result)
  const query2 = `
   select tweet.tweet ,COUNT(DISTINCT(like.like_id)) AS likes, COUNT(DISTINCT(reply.reply)) AS replies, tweet.date_time AS dateTime  
   from tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
   INNER JOIN like ON tweet.tweet_id = like.tweet_id  
   WHERE  tweet.tweet_id = '${tweetId}'  ;
  `
  console.log('HI')
  const result1 = await db.get(query)
  //const getResult = await db.get(query2)
  if (result1 === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send(
      // result1.map(each => {
      //   return
      // {
      //   tweet: result1.tweet,
      //   likes: result1.likes_count,
      //   replies: result1.replies,
      //   dateTime: result1.date_time,
      // },
      // }),
      result1,
    )
  }
})
//API 11
app.delete('/tweets/:tweetId/', authentication, async (request, response) => {
  const {tweetId} = request.params
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query = `
  select * from tweet where tweet_id = '${tweetId}'
  `
  const check = await db.get(query)
  if (check.user_id === userId) {
    const query2 = `
  DELETE FROM tweet WHERE tweet = '${tweetId}'
  `
    await db.run(query2)
    response.send('Tweet Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//API 10
app.post('/user/tweets/', authentication, async (request, response) => {
  const tweet = request.body.tweet
  console.log(tweet)
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query2 = `
  INSERT INTO tweet("tweet", "user_id") 
  VALUES(
    '${tweet}',
    '${userId}'
  )
  `
  console.log('Hi')
  const result = await db.run(query2)
  console.log(result.lastId)
  response.send('Created a Tweet')
})

module.exports = app

//API 9
app.get('/user/tweets/', authentication, async (request, response) => {
  const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
  const user = await db.get(query1)
  const userId = user.user_id
  console.log(userId)
  const query2 = `
  SELECT 
  tweet.tweet ,
  COUNT(DISTINCT(like.like_id)) AS likes ,
  COUNT(DISTINCT(reply.reply_id)) AS replies ,
  tweet.date_time AS dateTime
  FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
  INNER JOIN like ON tweet.tweet_id = like.tweet_id 
  WHERE tweet.user_id = '${userId}'
  GROUP BY tweet.tweet_id 
  `
  const result = await db.all(query2)
  response.send(result)
})

//API 8
app.get(
  '/tweets/:tweetId/likes/',
  authentication,
  async (request, response) => {
    const {tweetId} = request.params
    let arr = []
    const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
    const user = await db.get(query1)
    const userId = user.user_id
    console.log(userId)
    const query = `
  SELECT *
  FROM user INNER JOIN follower 
  ON user.user_id = follower.follower_user_id 
  WHERE follower.following_user_id = '${userId}' ;
  `
    const result = await db.all(query)
    result.map(each => {
      arr.push(each.username)
    })
    console.log(arr)
    const query3 = `
    SELECT * FROM user INNER JOIN tweet  
    ON user.user_id = tweet.user_id
    WHERE tweet_id = '${tweetId}'
    `
    const checkUser = await db.get(query3)
    console.log(checkUser.username)
    if (arr.includes(checkUser.username) === false) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const query2 = `
    SELECT 
     user.username 
    FROM tweet INNER JOIN like ON 
    tweet.tweet_id = like.tweet_id 
    INNER JOIN user ON like.user_id = user.user_id 
    WHERE tweet.tweet_id = '${tweetId}'  ;
    `
      const finalResult = await db.all(query2)
      likedUsers = finalResult.map(eachUser => {
        return eachUser.username
      })
      console.log(likedUsers)

      response.send({
        likes: likedUsers,
      })
    }
  },
)

//API 8
app.get(
  '/tweets/:tweetId/replies/',
  authentication,
  async (request, response) => {
    const {tweetId} = request.params
    let arr = []
    const query1 = `
  SELECT * from user WHERE username = '${request.username}'
  `
    const user = await db.get(query1)
    const userId = user.user_id
    console.log(userId)
    const query = `
  SELECT *
  FROM user INNER JOIN follower 
  ON user.user_id = follower.follower_user_id 
  WHERE follower.following_user_id = '${userId}' ;
  `
    const result = await db.all(query)
    result.map(each => {
      arr.push(each.username)
    })
    console.log(arr)
    const query3 = `
    SELECT * FROM user INNER JOIN tweet  
    ON user.user_id = tweet.user_id
    WHERE tweet_id = '${tweetId}'
    `
    const checkUser = await db.get(query3)
    console.log(checkUser.username)
    if (arr.includes(checkUser.username) === false) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const query2 = `
    SELECT 
     user.name , reply.reply 
    FROM tweet INNER JOIN reply ON 
    tweet.tweet_id = reply.tweet_id 
    INNER JOIN user ON reply.user_id = user.user_id 
    WHERE tweet.tweet_id = '${tweetId}'  ;
    `
      const finalResult = await db.all(query2)
      likedUsers = finalResult.map(eachUser => {
        return {
          name: eachUser.name,
          reply: eachUser.reply,
        }
      })
      console.log(likedUsers)

      response.send({
        replies: likedUsers,
      })
    }
  },
)
