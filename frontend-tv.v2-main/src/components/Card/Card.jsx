import React, { useEffect, useState } from "react";
import "./Card.css";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import Loader from "../../components/Loader/Loader";

const Card = () => {
    const navigate = useNavigate();

    const [signalTv, setSignalTv] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [imageLoading, setImageLoading] = useState({});
    const [currentPage, setCurrentPage] = useState(1);

    const cardsPerPage = 12;

    const getAllSignal = async () => {
        setIsLoading(true);
        try {
            const res = await api.listChannelDiagrams();
            const raw = Array.isArray(res?.data) ? res.data : [];
            const signals = raw.map((it) => it?.signal ?? null).filter(Boolean);

            if (signals.length === 0) {
                setSignalTv([]);
                setHasError(true);
                return;


            }

            const toNum = (v) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            };

            const normalized = signals.map((s) => ({
                ...s,
                numberChannelSur: toNum(s?.numberChannelSur),
                numberChannelCn: toNum(s?.numberChannelCn),
            }));

            const sorted = [...normalized].sort((a, b) => {
                const an = a.numberChannelSur ?? Number.POSITIVE_INFINITY;
                const bn = b.numberChannelSur ?? Number.POSITIVE_INFINITY;
                return an - bn;
            });

            setSignalTv(sorted);
            setHasError(false);
        } catch (error) {
            console.error("Error al obtener las señales:", error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        getAllSignal();
    }, []);

    const handleClick = (e) => {
        const card = e.target.closest(".card__container");
        const id = card?.dataset.id;
        if (id) navigate(`/signal/${id}`);
    };

    const handleImageLoad = (id) => {
        setImageLoading((prev) => ({ ...prev, [id]: false }));
    };

    const handleImageStartLoading = (id) => {
        setImageLoading((prev) => ({ ...prev, [id]: true }));
    };

    // Paginación
    const totalCards = signalTv.length;
    const totalPages = Math.ceil(totalCards / cardsPerPage);
    const indexOfLastCard = currentPage * cardsPerPage;
    const indexOfFirstCard = indexOfLastCard - cardsPerPage;
    const currentCards = signalTv.slice(indexOfFirstCard, indexOfLastCard);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

    const tipoTv = signalTv.filter((s) => s.tipoServicio === "TV").length;
    const tipoRadio = signalTv.filter((s) => s.tipoServicio === "Radio").length;

    return (
        <>
            {isLoading ? (
                <div className="loader__charge">
                    <Loader message="Cargando y conectando con el servidor..." />
                </div>
            ) : hasError ? (
                <p className="error__data">No se encuentran datos. Comuníquese con el administrador.</p>
            ) : (
                <div className="card__layout">
                    <h3 className="card__heading">
                        <span className="card__total">{totalCards}</span> señales en total
                        <span className="pill pill--tv">TV: {tipoTv}</span>
                        <span className="pill pill--radio">Radios: {tipoRadio}</span>
                    </h3>

                    <div className="card__grid">
                        {currentCards.map((signalItem) => {
                            const isImgLoading = imageLoading[signalItem._id];
                            return (
                                <div
                                    className="card__container"
                                    key={signalItem._id}
                                    data-id={signalItem._id}
                                    onClick={handleClick}
                                >
                                    <div className="card__header">
                                        <h4 className="card__title" title={signalItem.nameChannel}>
                                            {signalItem.nameChannel}
                                        </h4>
                                        <div className="card__number">
                                            <span className="badge">Norte: {signalItem.numberChannelCn ?? "-"}</span>
                                            <span className="badge">Sur: {signalItem.numberChannelSur ?? "-"}</span>
                                        </div>
                                    </div>

                                    <div className="card__image-wrapper">
                                        {isImgLoading && <div className="card__spinner" />}
                                        <img
                                            className="card__logo"
                                            src={signalItem.logoChannel}
                                            alt={`Logo de ${signalItem.nameChannel}`}
                                            onLoad={() => handleImageLoad(signalItem._id)}
                                            onLoadStart={() => handleImageStartLoading(signalItem._id)}
                                            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                                            style={{ visibility: isImgLoading ? "hidden" : "visible" }}
                                        />
                                    </div>

                                    <div className="card__footer">
                                        <div className="tech">{signalItem.tipoTecnologia}</div>
                                        <div className="sev">
                                            Severidad: <strong>{signalItem.severidadChannel}</strong>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pagination">
                        <button onClick={prevPage} disabled={currentPage === 1}>
                            &laquo; Anterior
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .slice(Math.max(0, currentPage - 3), currentPage + 2)
                            .map((page) => (
                                <button
                                    key={page}
                                    className={page === currentPage ? "active" : ""}
                                    onClick={() => paginate(page)}
                                >
                                    {page}
                                </button>
                            ))}
                        <button onClick={nextPage} disabled={currentPage === totalPages}>
                            Siguiente &raquo;
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Card;
