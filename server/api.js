const express = require('express')
const db = require('./db')

let api = express.Router()

api.get('/funding', (req, res, next) => {
  db.all(
    `SELECT * FROM investment 
       WHERE fully_funded = 0
       ORDER BY created_on DESC
    `,
    (err, rows) => {
      if (err) {
        next(err)
      }
      return res.json(rows)
    }
  )
})

api.get('/funded', (req, res, next) => {
  db.all(
    `SELECT * FROM investment 
       WHERE fully_funded = 1
       ORDER BY created_on DESC
    `,
    (err, rows) => {
      if (err) {
        next(err)
      }
      return res.json(rows)
    }
  )
})

api.get('/investment/:id', (req, res, next) => {
  db.get(
    `SELECT id, purpose, address, rate, expected_term_months, loan_amount_dollars,
                  fully_funded, created_on
           FROM investment WHERE id = ?`,
    [Number(req.params.id)],
    (err, row) => {
      if (err) {
        next(err)
      }

      res.json(row)
    }
  )
})

api.get('/investment/:id/funds', (req, res, next) => {
  db.all(
    `SELECT id, investment_id, amount, created_on
           FROM funding WHERE investment_id = ?`,
    [Number(req.params.id)],
    (err, rows) => {
      if (err) {
        next(err)
      }

      res.json(rows)
    }
  )
})

api.get('/fund/:id', (req, res, next) => {
  db.get(
    `SELECT id, investment_id, amount, created_on
           FROM funding WHERE id = ?`,
    [Number(req.params.id)],
    (err, row) => {
      if (err) {
        next(err)
      }

      res.json(row)
    }
  )
})

api.post('/investment', (req, res, next) => {
  let {
    purpose,
    address,
    rate,
    expected_term_months,
    loan_amount_dollars
  } = req.body

  db.serialize(() => {
    db.run(
      `INSERT INTO investment 
        (purpose, address, rate, expected_term_months, loan_amount_dollars)
       VALUES (?, ?, ?, ?, ?);
      `,
      [purpose, address, rate, expected_term_months, loan_amount_dollars],
      err => {
        if (err) {
          next(err)
        }
        db.get(
          `SELECT id, purpose, address, rate, expected_term_months, loan_amount_dollars,
                  fully_funded, created_on
           FROM investment WHERE rowid = ?`,
          [this.lastID],
          (err, row) => {
            if (err) {
              next(err)
            }
            res.json(row)
          }
        )
      }
    )
  })
})

api.post('/funding', (req, res, next) => {
  let { investment_id, amount } = req.body

  db.get(
    `SELECT investment.id, loan_amount_dollars, fully_funded, SUM(funding.amount) as total_funding
     FROM investment
     LEFT JOIN funding
       ON funding.investment_id = investment.id
     WHERE investment.id = ?
     GROUP BY investment.id;`,
    [Number(investment_id)],
    (err, funding_row) => {
      if (err) {
        next(err)
      }
      let total = Number(funding_row.total_funding) + Number(amount)
      if (total > funding_row.loan_amount_dollars) {
        res.json({"error": "Amount exceeds the remaining funding need."})
      } else {
        db.serialize(() => {
          db.run(
            `INSERT INTO funding
            (investment_id, amount)
            VALUES (?, ?);
            `,
            [investment_id, amount],
            err => {
              if (err) {
                next(err)
              }

              if (total == Number(funding_row.loan_amount_dollars)) {
                // funded
                db.run("UPDATE investment SET fully_funded = 1 WHERE id = ?", investment_id)
              } 
              db.get(
                `SELECT id, investment_id, amount, created_on
                 FROM funding WHERE rowid = ?`,
                [this.lastID],
                (err, row) => {
                  if (err) {
                    next(err)
                  }                  
                  res.json(row)
                }
              )              
            }
          )
        })      
      }
    })
})

module.exports = api
