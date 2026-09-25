const { ingestMasters, ingestMarksheets } = require('../utils/repairIngest');

const uploadMasters = async (req, res) => {
  try {
    const result = await ingestMasters({ programme: 'UG', body: req.body });
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const uploadMarksheets = async (req, res) => {
  try {
    const result = await ingestMarksheets({ programme: 'UG', body: req.body });
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  uploadMasters,
  uploadMarksheets,
};
