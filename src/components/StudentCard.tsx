"use client";

import { getStudentCard } from "@/app/actions/user";
import { code128Bars } from "@/lib/barcode";
import type { StudentCardBrand, StudentCardView } from "@/lib/student-card";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

function Code128Barcode({ value }: { value: string }) {
	const graphic = useMemo(() => {
		try {
			return code128Bars(value);
		} catch {
			return null;
		}
	}, [value]);

	if (!graphic) return null;

	const quiet = 10;
	const width = graphic.moduleCount + quiet * 2;
	return (
		<svg
			className="student-card-barcode-svg"
			viewBox={`0 0 ${width} 48`}
			preserveAspectRatio="none"
			aria-hidden
		>
			{graphic.bars.map((bar, index) => (
				<rect
					key={`${bar.x}-${index}`}
					x={quiet + bar.x}
					y={0}
					width={bar.width}
					height={48}
					fill="#111111"
				/>
			))}
		</svg>
	);
}

function VtcMark() {
	return (
		<svg className="student-card-mark student-card-mark-vtc" viewBox="0 0 72 48" aria-hidden>
			<text x="0" y="36" fill="#1a1a1a" fontSize="32" fontWeight="700" fontFamily="Arial, sans-serif">
				VTC
			</text>
		</svg>
	);
}

function CampusLogo({ brand }: { brand: StudentCardBrand }) {
	if (brand === "hkiit") {
		return (
			<div className="student-card-campus">
				<img
					className="student-card-mark"
					src="/campus/hkiit-mark.png"
					alt=""
					width={130}
					height={138}
				/>
				<div className="student-card-wordmark">
					<span className="student-card-wordmark-en">HKIIT</span>
					<span className="student-card-wordmark-sub">Member of VTC Group</span>
					<span className="student-card-wordmark-sub">VTC 機構成員</span>
				</div>
			</div>
		);
	}

	return (
		<div className="student-card-campus">
			<VtcMark />
			<div className="student-card-wordmark">
				<span className="student-card-wordmark-en">VTC</span>
				<span className="student-card-wordmark-sub">Vocational Training Council</span>
				<span className="student-card-wordmark-sub">職業訓練局</span>
			</div>
		</div>
	);
}

export function StudentCardFace({
	card,
	validThroughLabel,
	photoAlt,
	spoilerLabel,
	showCardLabel,
	hideCardLabel,
	conceal = false,
}: {
	card: StudentCardView;
	validThroughLabel: string;
	photoAlt: string;
	spoilerLabel: string;
	showCardLabel: string;
	hideCardLabel: string;
	conceal?: boolean;
}) {
	const [revealed, setRevealed] = useState(false);

	useEffect(() => {
		if (conceal) setRevealed(false);
	}, [conceal]);

	return (
		<button
			type="button"
			className={`student-card-spoiler${revealed ? " is-revealed" : ""}`}
			onClick={() => setRevealed((open) => !open)}
			aria-pressed={revealed}
			aria-label={revealed ? hideCardLabel : showCardLabel}
		>
			<div className="student-card" aria-hidden={!revealed}>
				<div className="student-card-shade" aria-hidden />
				<div className="student-card-white" aria-hidden />
				<div className="student-card-ribbon" aria-hidden>
					<span>STUDENT CARD</span>
				</div>
				<CampusLogo brand={card.brand} />
				<div className={`student-card-photo-frame${card.photoSrc ? "" : " student-card-photo-empty"}`}>
					{card.photoSrc ? (
						<img src={card.photoSrc} alt={revealed ? photoAlt : ""} />
					) : null}
				</div>
				<div className="student-card-identity">
					<p className="student-card-name-en">{card.englishName}</p>
					{card.chineseName ? (
						<p className="student-card-name-zh">{card.chineseName}</p>
					) : null}
					{card.programme ? (
						<p className="student-card-programme">{card.programme}</p>
					) : null}
				</div>
				<p className="student-card-valid">
					<span>{validThroughLabel}</span>
					<strong>
						{card.expiryDate}
						{card.deliveryMode ? ` ${card.deliveryMode}` : ""}
					</strong>
				</p>
				{card.barcodeValue ? (
					<div className="student-card-barcode">
						<p>{card.barcodeCaption}</p>
						<Code128Barcode value={card.barcodeValue} />
					</div>
				) : null}
			</div>
			{revealed ? null : (
				<span className="student-card-spoiler-tag">{spoilerLabel}</span>
			)}
		</button>
	);
}

export default function StudentCardPanel({
	enabled,
	conceal = false,
}: {
	enabled: boolean;
	conceal?: boolean;
}) {
	const t = useTranslations("settings");
	const [card, setCard] = useState<StudentCardView | null>(null);
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled) {
			setLoading(false);
			setCard(null);
			setError(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		void getStudentCard().then((result) => {
			if (cancelled) return;
			if (result.success && result.data) {
				setCard(result.data);
				setError(null);
			} else {
				setCard(null);
				setError(result.error || t("studentCardUnavailable"));
			}
			setLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [enabled, t]);

	if (!enabled) {
		return <p className="student-card-status">{t("studentCardNeedSync")}</p>;
	}

	if (loading) {
		return (
			<div className="student-card student-card-skeleton" aria-busy="true" aria-label={t("studentCardLoading")}>
				<div className="student-card-ribbon" aria-hidden>
					<span>STUDENT CARD</span>
				</div>
			</div>
		);
	}

	if (error || !card) {
		return <p className="student-card-status student-card-status-error">{error || t("studentCardUnavailable")}</p>;
	}

	return (
		<StudentCardFace
			card={card}
			validThroughLabel={t("studentCardValidThrough")}
			photoAlt={t("studentCardPhotoAlt")}
			spoilerLabel={t("studentCardSpoiler")}
			showCardLabel={t("studentCardShow")}
			hideCardLabel={t("studentCardHide")}
			conceal={conceal}
		/>
	);
}
