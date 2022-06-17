"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const { MoleculerError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Project = require("../models/Project.js");

module.exports = {
	name: "project",
	logger: true,
	mixins: [DbService, axiosMixin],
	adapter: dbConnection.getMongooseAdapter(),
	model: Project,

	actions: {
		editProjectName: {
			params: {
				projectId: { type: "string" },
				projectNewName: { type: "string", min: 2, max: 60 },
			},
			async handler(ctx) {
				try {
					const filter = { _id: ctx.params.projectId };
					const update = { projectName: ctx.params.projectNewName };

					return await Project.findOneAndUpdate(filter, update);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR EDITING PROJECT NAME", {
						message: error.message,
						internalErrorCode: "project20",
					});
				}
			},
		},
		deleteProject: {
			params: {
				projectId: { type: "string" },
			},
			async handler(ctx) {
				try {
					let projectObject = await Project.findOne({ _id: ctx.params.projectId });
					console.log("Project to delete: ", projectObject);

					if (projectObject._wallets.length > 0) {
						console.log("deleteProject: CAN NOT DELETE PROJECT WITH ASSETS");
						throw new MoleculerError("CAN NOT DELETE PROJECT WITH ASSETS", 401, "CAN NOT DELETE PROJECT WITH ASSETS", {
							message: "CAN NOT DELETE PROJECT WITH ASSETS",
							internalErrorCode: "project210",
						});
					}

					return await Project.deleteOne({ _id: ctx.params.projectId });
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR DELETING PROJECT", {
						message: error.message,
						internalErrorCode: "project200",
					});
				}
			},
		},
		addQrCodeToProject: {
			params: {
				projectId: { type: "string", },
				itemId: { type: "string" },
			},
			async handler(ctx) {
				try {
					const { itemId, projectId } = ctx.params;
					console.log("addQrCodeToProject ctx.params: ", ctx.params);


					let data = {
						$addToSet: { _wallets: String(itemId) },
					};

					// getCurrentProject
					let getOldProjectId = await ctx.call("wallet.getProjectIdFromQrCode", { itemId });
					let projectIdOld = getOldProjectId[0]._project;

					console.log("addQrCodeToProject projectIdOld: ", projectIdOld);





					// ------------------ UPDATE NEW PROJECT - CHOOSEN - what user is selected ------------------------
					console.log("\n\naddQrCodeToProject UPDATE NEW PROJECT: ");

					const entity = {
						_id: (ctx.params.projectId === "noproject") ? projectIdOld : projectId
					};

					console.log("addQrCodeToProject entity: ", entity);

					let findOneAndUpdateNew = await Project.findOneAndUpdate(entity, data, { new: true });

					console.log("addQrCodeToProject findOneAndUpdateNew :  ", findOneAndUpdateNew);

					console.log("\n\naddQrCodeToProject wallet.addProjectToWallet CALL WALLET SERVICE");
					console.log("addQrCodeToProject wallet.addProjectToWallet projectId ", projectId);
					console.log("addQrCodeToProject wallet.addProjectToWallet itemId ", itemId, "\n");


					// -------------------------------   UPDATE QR CODE -------------------------------
					let projectAdded = await ctx.call("wallet.addProjectToWallet", { projectId, itemId });
					console.log("\n\naddQrCodeToProject wallet.addProjectToWallet Response: ", projectAdded);

					let arrayOfQrCodeObject = [];
					if (projectAdded.length > 0) {
						projectAdded.map((item) => {
							arrayOfQrCodeObject.push(item._id);
						});
					}

					let qrCodesInProject = {
						_wallets: arrayOfQrCodeObject,
					};

					console.log("addQrCodeToProject qrCodesInProject ", qrCodesInProject);

					let findOneAndUpdateRes = await Project.findOneAndUpdate(entity, qrCodesInProject, { new: true });

					console.log("addQrCodeToProject findOneAndUpdateRes: ", findOneAndUpdateRes);





					// --------------------------- UPDATE OLD PROJECT - CURRENT  --------------------------------
					console.log("\n\n addQrCodeToProject UPDATE OLD PROJECT : START ");
					let getAllQrCodesFromProjectRes = await ctx.call("wallet.getAllQrCodesFromProject", { projectIdOld });

					let arrayOfQrCodeObjectOld = [];
					if (getAllQrCodesFromProjectRes.length > 0) {
						getAllQrCodesFromProjectRes.map((item) => {
							arrayOfQrCodeObjectOld.push(item._id);
						});
					}

					let qrCodesInProjectOld = {
						_wallets: arrayOfQrCodeObjectOld,
					};

					console.log("addQrCodeToProject qrCodesInProjectOld ", qrCodesInProjectOld);

					const entityOld = {
						_id: projectIdOld,
					};

					console.log("addQrCodeToProject entityOld ", entityOld);

					let findOneAndUpdateResOld = await Project.findOneAndUpdate(entityOld, qrCodesInProjectOld, { new: true });

					console.log("addQrCodeToProject findOneAndUpdateResOld ", findOneAndUpdateResOld);

					return projectAdded;
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR ADDING QR CODE TO PROJECT", {
						message: error.message,
						internalErrorCode: "project300",
					});
				}
			},
		},
		addNewProject: {
			params: {
				projectName: { type: "string", min: 2, max: 60 },
				//projectDescription: { type: "string", max: 255 },
			},
			async handler(ctx) {
				try {
					let _user = ctx.meta.user.userId;
					let data = {
						projectName: ctx.params.projectName,
						_user,
						//	projectDescription: ctx.params.projectDescription,
					};
					const { userEmail } = ctx.meta.user;
					let project = new Project(data);
					await project.save();
					await ctx.call("user.addProjectToUser", { project, userEmail });
					return project;
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR CREATING PROJECT", {
						message: error.message,
						internalErrorCode: "project400",
					});
				}
			},
		},
		getOneProject: {
			params: {
				projectId: { type: "string", min: 2, max: 60 },
			},
			async handler(ctx) {
				try {
					const data = {
						_id: ctx.params.projectId
					};

					return await Project.findOne(data)
						.populate(
							{
								path: "_wallets",
								populate: {
									path: "_image _nfts"
								},
							},
						);

				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR GETTING PROJECT", {
						message: error.message,
						internalErrorCode: "project156",
					});
				}
			}
		}
	},
	methods: {},
};