import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../utils/api";
import { useEffect, useState } from "react";
import Loader from "../../components/Loader/Loader";
import "../../components/Card/Card.css";
import "./SearchFilter.css";

const SearchFilter = () => {
  const [querySearch] = useSearchParams();
  const keyword = querySearch.get("keyword");

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
        const response = await api.searchFilter(keyword);

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

    if (keyword && keyword.trim() !== "") {
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

  const handleClick = (e) => {
    const card = e.target.closest(".card__container");
    const id = card?.dataset.id;
    if (id) {
      navigate(`/signal/${id}`);
    }
  };

  // Handlers para carga de imágenes
  const handleImageLoad = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: false }));
  };

  const handleImageStartLoading = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: true }));
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
        <>
          <div className="container__search">
            <span className="search__register">
              {dataSearch.length > 1
                ? `Se encontraron ${dataSearch.length} registros`
                : `Se encontró ${dataSearch.length} registro`}
            </span>
            <div className="card__list">
              {dataSearch.map((signalItem) => {
                const isImgLoading = imageLoading[signalItem._id];
                return (
                  <div
                    className="card__container"
                    key={signalItem._id}
                    data-id={signalItem._id}
                    onClick={handleClick}
                  >
                    <div className="card__group-item">
                      <h4 className="card__title">{signalItem.nameChannel}</h4>
                      <div className="card__number">
                        <h5 className="card__number-item">{`Norte: ${signalItem.numberChannelCn}`}</h5>
                        <h5 className="card__number-item">{`Sur: ${signalItem.numberChannelSur}`}</h5>
                      </div>
                    </div>

                    {/* Imagen con loader */}
                    <div className="card__image-wrapper">
                      {isImgLoading && <div className="card__spinner" />}
                      <img
                        className="card__logo"
                        src={signalItem.logoChannel}
                        alt="Logo del canal"
                        onLoad={() => handleImageLoad(signalItem._id)}
                        onLoadStart={() => handleImageStartLoading(signalItem._id)}
                        style={{ display: isImgLoading ? "none" : "block" }}
                      />
                    </div>

                    <div className="card__severidad">
                      <span>{signalItem.tipoTecnologia}</span>
                      <br />
                      <span>{`Severidad: ${signalItem.severidadChannel}`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchFilter;
