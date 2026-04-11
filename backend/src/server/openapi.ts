export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "Marktplaats Watch API",
		version: "0.1.0",
		description: "API for monitoring Marktplaats listings with saved searches",
	},
	paths: {
		"/status": {
			get: {
				summary: "Health check",
				responses: {
					"200": {
						description: "Server status",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										ok: { type: "boolean" },
										provider: { type: "object" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/watches": {
			get: {
				summary: "List all watches",
				responses: {
					"200": {
						description: "Array of watches",
						content: {
							"application/json": {
								schema: { type: "array", items: { $ref: "#/components/schemas/WatchConfig" } },
							},
						},
					},
				},
			},
			post: {
				summary: "Create a watch",
				requestBody: {
					required: true,
					content: {
						"application/json": { schema: { $ref: "#/components/schemas/CreateWatch" } },
					},
				},
				responses: {
					"201": {
						description: "Created watch",
						content: {
							"application/json": { schema: { $ref: "#/components/schemas/WatchConfig" } },
						},
					},
					"400": { description: "Validation error" },
				},
			},
		},
		"/watches/{id}": {
			get: {
				summary: "Get watch with state",
				parameters: [
					{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
				],
				responses: {
					"200": {
						description: "Watch and state",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										watch: { $ref: "#/components/schemas/WatchConfig" },
										state: { $ref: "#/components/schemas/WatchState" },
									},
								},
							},
						},
					},
					"404": { description: "Not found" },
				},
			},
			put: {
				summary: "Update a watch",
				parameters: [
					{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": { schema: { $ref: "#/components/schemas/UpdateWatch" } },
					},
				},
				responses: {
					"200": {
						description: "Updated watch",
						content: {
							"application/json": { schema: { $ref: "#/components/schemas/WatchConfig" } },
						},
					},
					"400": { description: "Validation error" },
					"404": { description: "Not found" },
				},
			},
			delete: {
				summary: "Delete a watch",
				parameters: [
					{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
				],
				responses: {
					"200": {
						description: "Deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { deleted: { type: "boolean" } },
								},
							},
						},
					},
					"404": { description: "Not found" },
				},
			},
		},
		"/watches/{id}/poll": {
			post: {
				summary: "Trigger immediate poll",
				parameters: [
					{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
				],
				responses: {
					"200": {
						description: "Poll result",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										polled: { type: "boolean" },
										eventsCount: { type: "integer" },
									},
								},
							},
						},
					},
					"404": { description: "Not found" },
				},
			},
		},
	},
	components: {
		schemas: {
			SearchOptions: {
				type: "object",
				required: ["query"],
				properties: {
					query: { type: "string", minLength: 1 },
					categorySlug: { type: "string" },
					zipCode: { type: "string" },
					distance: { type: "number", description: "Radius in km" },
					priceFromCents: { type: "integer", description: "Min price in cents" },
					priceToCents: { type: "integer", description: "Max price in cents" },
					limit: { type: "integer", default: 50 },
					page: { type: "integer" },
					sortBy: { type: "string", enum: ["price", "date"] },
					sortOrder: { type: "string", enum: ["asc", "desc"] },
				},
			},
			WatchConfig: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string" },
					searchOptions: { $ref: "#/components/schemas/SearchOptions" },
					webhookUrl: { type: "string", format: "uri" },
					intervalMinutes: { type: "integer", minimum: 5 },
					enabled: { type: "boolean" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			CreateWatch: {
				type: "object",
				required: ["name", "searchOptions"],
				properties: {
					name: { type: "string", minLength: 1 },
					searchOptions: { $ref: "#/components/schemas/SearchOptions" },
					webhookUrl: { type: "string", format: "uri" },
					intervalMinutes: { type: "integer", minimum: 5, default: 15 },
				},
			},
			UpdateWatch: {
				type: "object",
				properties: {
					name: { type: "string", minLength: 1 },
					searchOptions: { $ref: "#/components/schemas/SearchOptions" },
					webhookUrl: { type: "string", format: "uri", nullable: true },
					intervalMinutes: { type: "integer", minimum: 5 },
					enabled: { type: "boolean" },
				},
			},
			WatchState: {
				type: "object",
				properties: {
					watchId: { type: "string", format: "uuid" },
					lastPolledAt: { type: "string", format: "date-time", nullable: true },
					listings: {
						type: "object",
						additionalProperties: { $ref: "#/components/schemas/TrackedListing" },
					},
				},
			},
			TrackedListing: {
				type: "object",
				properties: {
					sourceListingId: { type: "string" },
					firstSeenAt: { type: "string", format: "date-time" },
					lastSeenAt: { type: "string", format: "date-time" },
					priceHistory: {
						type: "array",
						items: {
							type: "object",
							properties: {
								priceCents: { type: "integer", nullable: true },
								seenAt: { type: "string", format: "date-time" },
							},
						},
					},
				},
			},
		},
	},
};
