const sendCheckInTo = require('./zapier')
const streakMessage = require('./streakMessage')
const Airtable = require('airtable')
const secrets = require('./secrets')
const base = new Airtable({
  apiKey: secrets['AIRTABLE_API_KEY']
}).base(
  'apptEEFG5HTfGQE7h'
)

module.exports = dateArg => {
  date = dateArg ? new Date(dateArg) : new Date()

  const dayIndex = dateArg ? date.getUTCDay() : new Date().getDay()
  const today = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ][dayIndex]

  const fetchClubs = base('Clubs')
    .select({
      filterByFormula: `{Check-in day} = "${today}"`,
    })
    .all()

  const fetchEventsFrom = clubName =>
    base('History')
    .select({
      filterByFormula: `AND(
        FIND('${clubName}', {Club}),
        OR(
          FIND('Meeting', {Type}) != 0,
          FIND('Check-in', {Type}) != 0
        )
      )`,
    })
    .all()

  const findAll = clubName =>
    base('History')
    .select({
      filterByFormula: `FIND('${clubName}', {Club})`
    })
    .all()

  const calculateStreak = clubName => (
    findAll(clubName).then(clubRecords => {
      index = 0
      clubRecords.forEach(record => {
        awaitingResponse = record.get('Type').indexOf('Awaiting response') !== -1
        checkIn = record.get('Type').indexOf('Check-in') !== -1
        meeting = record.get('Type').indexOf('Meeting') !== -1
        if (checkIn && !awaitingResponse) {
          index++
        } else if (awaitingResponse) {
          return index
        }
      })
      return index
    })
  )

  fetchClubs.then(clubs => {
    clubs.forEach(clubRecord => {
      let clubName = clubRecord.get('Name')
      calculateStreak(clubName).then(streakCount => {
        sendCheckInTo({
          name: clubName,
          email: clubRecord.get('Contact Email')[0],
          streak: streakMessage(streakCount),
          date: date
        })
      })
    })
  })
}