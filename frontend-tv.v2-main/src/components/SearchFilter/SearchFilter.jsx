import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Loader from "../../components/Loader/Loader";
import api from "../../utils/api";
import "../../components/Card/Card.css";
import "./SearchFilter.css";

const SearchFilter = () => {
  const [querySearch] = useSearchParams();
  const keyword = querySearch.get("keyword")?.trim() ?? "";

  const [dataSearch, setDataSearch] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [imageLoading, setImageLoading] = useState({}); // 👈 Para controlar el estado de carga por imagen

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await api.searchChannels(keyword);

        if (cancelled) return;

        if (response.data.length > 0) {
          setDataSearch(response.data);
          setNoResults(false);
          setHasError(false);
        } else {
          setDataSearch([]);
          setNoResults(true);
          setHasError(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error al obtener las señales:", error);
        setHasError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    if (keyword) {
      setImageLoading({});
      fetchData();
    } else {
      setDataSearch([]);
      setNoResults(true);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [keyword]);

  const handleCardClick = (id) => {
    navigate(`/signal/${id}`);
  };

  // Handlers para carga de imágenes
  const handleImageLoad = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: false }));
  };

  const handleImageStartLoading = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: true }));
  };

  const handleImageError = (id, event) => {
    event.currentTarget.style.display = "none";
    setImageLoading((prev) => ({ ...prev, [id]: false }));
  };

  return (
    <div className="container__result">
      {isLoading ? (
        <Loader message="Cargando y conectando con el servidor..." />
      ) : hasError ? (
        <p className="error__data">
          Error al conectar. Comuníquese con el administrador.
        </p>
      ) : noResults ? (
        <p className="error__data">
          No se encontraron resultados para: <strong>{keyword}</strong>
        </p>
      ) : (
        <div className="card__layout card__layout--search">
          <h3 className="card__heading card__heading--search">
            <span className="card__total">{dataSearch.length}</span>
            {dataSearch.length === 1
              ? " resultado encontrado"
              : " resultados encontrados"}
          </h3>
          {keyword && (
            <p className="search__subtitle">
              Coincidencias para <strong>{keyword}</strong>
            </p>
          )}

          <div className="card__grid">
            {dataSearch.map((signalItem) => {
              const id = signalItem._id;
              const isImgLoading = imageLoading[id];

              return (
                <button
                  key={id}
                  type="button"
                  className="card__container"
                  onClick={() => handleCardClick(id)}
                  aria-label={`Abrir detalle de ${signalItem.nameChannel}`}
                >
                  <div className="card__header">
                    <h4 className="card__title" title={signalItem.nameChannel}>
                      {signalItem.nameChannel}
                    </h4>
                    <div className="card__number">
                      <span className="badge">
                        Norte: {signalItem.numberChannelCn ?? "-"}
                      </span>
                      <span className="badge">
                        Sur: {signalItem.numberChannelSur ?? "-"}
                      </span>
                    </div>
                  </div>

                  <div className="card__image-wrapper">
                    {isImgLoading && <div className="card__spinner" />}
                    {signalItem.logoChannel ? (
                      <img
                        className="card__logo"
                        src={signalItem.logoChannel}
                        alt={`Logo de ${signalItem.nameChannel}`}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => handleImageLoad(id)}
                        onLoadStart={() => handleImageStartLoading(id)}
                        onError={(event) => handleImageError(id, event)}
                        style={{ visibility: isImgLoading ? "hidden" : "visible" }}
                      />
                    ) : (
                      <div className="card__logo--placeholder" aria-hidden="true">
                        {signalItem?.nameChannel?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  <div className="card__footer">
                    <div className="tech">{signalItem.tipoTecnologia}</div>
                    <div className="sev">
                      Severidad: <strong>{signalItem.severidadChannel}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
