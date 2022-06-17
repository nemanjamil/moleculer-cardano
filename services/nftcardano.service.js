"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const axiosMixin = require("../mixins/axios.mixin");
const Nftcardano = require("../models/Nftcardano");
const { MoleculerError } = require("moleculer").Errors;

module.exports = {
	name: "nftcardano",
	mixins: [DbService, axiosMixin],
	adapter: dbConnection.getMongooseAdapter(),
	model: Nftcardano,

	actions: {
		storeToDb: {
			async handler(ctx) {
				const entity = {
					walletQrId: ctx.params.walletQrId,
					cid: ctx.params.cid,
					transactionId: ctx.params.transactionId,
					assetId: ctx.params.assetId,
				};
				console.log("store nft to db entity: ", entity);
				try {
					let nftcardano = new Nftcardano(entity);
					let nftSave = await nftcardano.save();
					await ctx.call("wallet.populateWalletTable", nftSave);
					return { nftSave };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		checkWallet: {
			params: {
				walletName: { type: "string" },
			},

			async handler(ctx) {
				try {
					console.log("checkWallet ctx.params: call ", ctx.params);
					let checkWallet = await this.axiosPost("http://host.docker.internal:3333/checkWallet", ctx.params);
					return checkWallet.data;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		createCardanoNft: {
			params: {
				imageIPFS: { type: "string" },
				assetName: { type: "string" },
				description: { type: "string" },
				authors: { type: "array", optional: true },
				copyright: { type: "string", optional: true },
				walletName: { type: "string" },
			},

			async handler(ctx) {
				try {
					console.log("createCardanoNft ctx.params: ", ctx.params);
					let mintNft = await this.axiosPost("http://host.docker.internal:3333/generateNFT", ctx.params);
					return { mintNFT: mintNft.data };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		createCardanoNftWithAssignWallet: {
			params: {
				imageIPFS: { type: "string" },
				assetName: { type: "string" },
				description: { type: "string" },
				authors: { type: "array", optional: true },
				addressWallet: { type: "string", optional: true },
				copyright: { type: "string", optional: true },
				walletName: { type: "string" },
				dalayCallToWalletAsset: { type: "number" },
			},

			async handler(ctx) {
				try {
					console.log("createCardanoNftWithAssignWallet START \n\n");
					console.log("Moglo bi da potraje > 60 sec ", ctx.params.dalayCallToWalletAsset);

					let defaultAddressWallet = "addr_test1qrjvha8weh6uknz5mv4s8m8hjzvv2nmc9hap3mk9ddfgptl5nrlujs9z7afw0cguvjuzzxq6dtmhjhcz8auach6p7s7q8pur88";

					console.log("createCardanoNftWithAssignWallet ctx.params", ctx.params);
					let generateNftParams = { ...ctx.params };

					delete generateNftParams.addressWallet;
					let addressWallet = ctx.params.addressWallet ? ctx.params.addressWallet : defaultAddressWallet;

					console.log("createCardanoNftWithAssignWallet AddressWallet", addressWallet);
					console.log("createCardanoNftWithAssignWallet GenerateNftParams", generateNftParams);

					console.log("  ==== createCardanoNftWithAssignWallet START MINT CALL NATIVE FUNCTION \n\n");
					let mintNft = await this.axiosPost("http://host.docker.internal:3333/generateNFT", generateNftParams);

					console.log("createCardanoNftWithAssignWallet USAO");
					console.log("createCardanoNftWithAssignWallet", mintNft.data);

					let payloadToWallet = {
						addressWallet,
						walletName: ctx.params.walletName,
						assetId: mintNft.data.assetId,
					};

					console.log("createCardanoNftWithAssignWallet PayloadToWallet", payloadToWallet);

					console.log("createCardanoNftWithAssignWallet Start Delay", Date.now(), ctx.params.dalayCallToWalletAsset);

					await this.addDelay(ctx.params.dalayCallToWalletAsset);

					console.log("createCardanoNftWithAssignWallet After Delay GO TO sendAssetToWallet NATIVE ", Date.now(), "\n\n");

					// Ovde treba ubaciti {{site_url}}api/nftcardano/checkWallet da proverimo da li asset sleteo na wallet
					// Ako jeste onda mozemo da radimo sendAssetToAnotherWallet

					let sendAssetToWallet = await this.axiosPost("http://host.docker.internal:3333/sendAssetToWallet", payloadToWallet);

					console.log("createCardanoNftWithAssignWallet Finished SendAssetToWallet", Date.now());

					return {
						payloadToWallet,
						mintNFT: mintNft.data,
						sendAssetToWallet: sendAssetToWallet.data,
					};
				} catch (error) {
					console.log("\n\n createCardanoNftWithAssignWallet error \n\n");
					console.dir(error);
					console.log("\n\n Error MESSAGE : ", error.message);

					throw new MoleculerError("Error With NFT Generating", 401, "NFT_GENERATING_BUG", {
						message: error.message,
					});

					//return Promise.reject("error.toString()");
				}
			},
		},

		updateDbSendingAssetDb: {
			async handler(ctx) {
				try {

					const { sendAssetToWallet, qrCodeStatus, nftParams } = ctx.params;

					console.log('\n\n\n ------ \n\n\n');
					console.log('updateDbSendingAssetDb sendAssetToWallet', sendAssetToWallet);
					console.log('updateDbSendingAssetDb qrCodeStatus', qrCodeStatus);
					console.log('updateDbSendingAssetDb nftParams', nftParams);

					let entity = {
						walletQrId: qrCodeStatus[0].walletQrId
					};

					let data = {
						addressClientWallet: nftParams.addressWallet,
						clientTxHash: sendAssetToWallet.sendAssetToWallet.txHash,
						initialAmountValue: nftParams.amountValue,
						walletNameSource: nftParams.walletName
					};

					console.log('updateDbSendingAssetDb entity', entity);
					console.log('updateDbSendingAssetDb data', data);

					return await Nftcardano.findOneAndUpdate(entity, { $set: data }, { new: true });

				} catch (error) {
					return Promise.reject(error);
				}
			},





		},

		sendAssetToWallet: {
			params: {
				walletName: { type: "string" },
				addressWallet: { type: "string" },
				assetId: { type: "string" },
				amountValue: { type: "number" },
			},

			async handler(ctx) {
				try {
					console.log("ctx.params", ctx.params);

					let payloadToWallet = {
						addressWallet: ctx.params.addressWallet,
						walletName: ctx.params.walletName,
						assetId: ctx.params.assetId,
						amountValue: ctx.params.amountValue,
					};
					console.log("sendAssetToWallet payloadToWallet", payloadToWallet);
					let sendAssetToWallet = await this.axiosPost("http://host.docker.internal:3333/sendAssetToWallet", payloadToWallet);
					return { sendAssetToWallet: sendAssetToWallet.data };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},
	},

	methods: {
		async addDelay(time) {
			return new Promise((res) => setTimeout(res, time));
		},
	},
};