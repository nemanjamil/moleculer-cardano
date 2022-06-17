const mongoose = require("mongoose");
//const ObjectId = mongoose.ObjectId;

const nftCardanoSchema = new mongoose.Schema({
	walletQrId: { type: String, index: true, required: true }, // unique: true
	transactionId: { type: String, required: true },
	assetId: { type: String, required: true },
	cid: { type: String, required: true },
	createdAt: { type: Date, default: Date.now, index: true },
	addressClientWallet: { type: String },
	clientTxHash: { type: String },
	walletNameSource: { type: String },
	initialAmountValue: { type: Number },
});

module.exports = mongoose.model("Nftcardano", nftCardanoSchema);