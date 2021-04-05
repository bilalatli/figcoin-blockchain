exports.defaultReturn = async (res, data) => {
  return res.status(200).json({
    success: true,
    message: "success",
    data: data,
  });
};

exports.defaultErrorReturn = async (res, msg) => {
  return res.status(400).json({
    success: false,
    message: msg,
  });
};
