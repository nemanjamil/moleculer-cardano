"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const { ValidationError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Wallet = require("../models/wallet.js");
require("dotenv").config();

module.exports = {
	name: "wallet",
	logger: true,
	mixins: [DbService, axiosMixin],
	adapter: new MongooseAdapter("mongodb://localhost/blokariawallet", {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useCreateIndex: true,
	}),
	model: Wallet,

	actions: {
		wallets: {
			async handler() {
				let response = await this.axiosGet("https://wallet-testnet.blokaria.com/v2/wallets");
				this.logger.warn(response);
				return response.data;
			},
		},

		initiateTransactionToClientWallet: {
			async handler(ctx) {
				try {
					let qrCodeStatus = await this.getQrCodeInfo(ctx);
					let parseObject = qrCodeStatus[0].qrCodeRedeemStatus;
					if (parseObject) return Promise.resolve({ rqcoderedeemstatus: "redeemed " });

					let transactionData = await this.sendTransactionFromWalletToWallet(process.env.WALLET_ADDRESS_5);
					await this.updateRedeemStatus(ctx, transactionData.data);

					console.log("transactionData.data");
					console.log(transactionData.data);

					return transactionData.data;
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		// this will combine to Messages and store under one QR code
		generateContract: {
			async handler(ctx) {
				try {
					let qrCodeStatus = await this.getQrCodeInfo(ctx);
					let parseObject = qrCodeStatus[0].qrCodeRedeemStatus;
					if (parseObject) return Promise.resolve({ rqcoderedeemstatus: "redeemed " });
					return await this.generateContractUpdateDataWithMessages(ctx);
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		getQrCodeData: {
			async handler(ctx) {
				try {
					await this.checkIfQrCodeExistIndb(ctx);
					return await this.getQrCodeInfo(ctx);
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		generateQrCodeInSystem: {
			async handler(ctx) {
				try {
					return await this.plainInsertDataIntoDb(ctx);
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		createWallet: {
			async handler() {
				try {
					let walletAddresses = await this.getWalletAddresses();
					let unusedAddress = this.parseAddressesForUnused(walletAddresses.data);
					let transactionData = await this.sendTransactionFromWalletToWallet(unusedAddress);

					return { unusedAddress, txId: transactionData.data };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},
	},

	methods: {
		parseAddressesForUnused(queryAddresses) {
			return queryAddresses
				.filter((el) => {
					return el.state === "unused";
				})
				.shift().id;
		},

		async generateContractUpdateDataWithMessages(ctx) {
			let entity = { walletQrId: ctx.params.qrcode };

			let data = {
				clientMessage: ctx.params.clientMessage,
				clientName: ctx.params.clientName,
			};

			try {
				return await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async updateRedeemStatus(ctx, transaction) {
			let entity = {
				walletQrId: ctx.params.qrcode,
			};
			let data = {
				qrCodeRedeemStatus: 1,
				transactionId: transaction.id,
			};
			try {
				let wallet = await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
				return wallet;
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async getQrCodeInfo(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.find(entity);
				return wallet;
			} catch (error) {
				return Promise.reject(error);
			}
		},
		async checkIfQrCodeExistIndb(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.exists(entity);
				if (!wallet) throw { message: "QR code doesn't exist in our system", internalErrorCode: 21 };
				return wallet;
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async insertDataIntoDb(ctx, Address, transactionId) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				walletDesc: ctx.params.walletDesc,
				userFullname: ctx.params.userFullname,
				userEmail: ctx.params.userEmail,
				usedAddress: Address,
				transactionId: transactionId,
			};
			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async plainInsertDataIntoDb(ctx) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				walletDesc: ctx.params.walletDesc,
				userFullname: ctx.params.userFullname,
				userEmail: ctx.params.userEmail,
			};
			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async getWalletAddresses() {
			let wallet_url = `${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/addresses`;
			this.logger.warn("== 2 == getWalletAddresses wallet_url ", wallet_url);

			try {
				return await this.axiosGet(wallet_url);
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async sendTransactionFromWalletToWallet(Address) {
			this.logger.warn("== 3 == unusedAddress", Address);
			try {
				return await this.axiosPost(`${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/transactions`, {
					passphrase: `${process.env.WALLET_PASSPHRASE_1}`,
					payments: [
						{
							address: Address,
							amount: {
								quantity: 1000000,
								unit: "lovelace",
							},
						},
					],
					withdrawal: "self",
				});
			} catch (error) {
				return Promise.reject(error);
			}
		},
	},
};
