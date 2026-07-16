import { MarktplaatsError } from "../types.js";

export class PosterError extends MarktplaatsError {
	constructor(message: string, code = "POSTER_ERROR") {
		super(message, code);
		this.name = "PosterError";
	}
}

export class SessionExpiredError extends PosterError {
	constructor(message = "Marktplaats session expired — re-link account") {
		super(message, "SESSION_EXPIRED");
		this.name = "SessionExpiredError";
	}
}

export class TokenExtractionError extends PosterError {
	constructor(message: string) {
		super(`Failed to extract SYI page tokens: ${message}`, "TOKEN_EXTRACTION");
		this.name = "TokenExtractionError";
	}
}

export class SubmitRejectedError extends PosterError {
	constructor(
		message: string,
		public readonly httpStatus?: number,
	) {
		super(`Marktplaats rejected submit: ${message}`, "SUBMIT_REJECTED");
		this.name = "SubmitRejectedError";
	}
}

export class AntiBotError extends PosterError {
	constructor(message = "Anti-bot check blocked the request") {
		super(message, "ANTI_BOT");
		this.name = "AntiBotError";
	}
}

export class CryptoError extends PosterError {
	constructor(message: string) {
		super(`Session crypto failure: ${message}`, "CRYPTO");
		this.name = "CryptoError";
	}
}
